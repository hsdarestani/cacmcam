from __future__ import annotations

import asyncio
import hashlib
import html
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import httpx
import redis
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse

PET_ORIGIN = 'http://pet:8020'
PLAYBACK_ORIGIN = 'http://mediamtx:9996'
REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/0')
CACHE_DIR = Path('/tmp/camcam-pet-playback')
CACHE_TTL_SECONDS = 30 * 60
CACHE_DIR.mkdir(parents=True, exist_ok=True)
_cache_locks: dict[str, asyncio.Lock] = {}

try:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=30)
except Exception:
    redis_client = None

app = FastAPI(title='CamCam Pet archive gateway', docs_url=None, redoc_url=None, openapi_url=None)


def cookie_header(request: Request) -> dict:
    cookie = request.headers.get('cookie', '')
    if not cookie:
        raise HTTPException(401, 'Authentication required')
    return {'cookie': cookie}


async def authorize(request: Request, device_id: str) -> None:
    async with httpx.AsyncClient(timeout=6) as client:
        response = await client.get(f'{PET_ORIGIN}/api/pet/devices/{device_id}/settings', headers=cookie_header(request))
    if response.status_code == 401:
        raise HTTPException(401, 'Authentication required')
    if response.status_code == 404:
        raise HTTPException(404, 'Camera not found')
    if response.status_code >= 400:
        raise HTTPException(403, 'Archive access denied')


async def authorize_device(request: Request) -> str:
    device_id = request.headers.get('x-device-id', '')
    token = request.headers.get('x-device-token', '')
    if not device_id or not token:
        raise HTTPException(401, 'Device credentials required')
    headers = {'X-Device-ID': device_id, 'X-Device-Token': token}
    async with httpx.AsyncClient(timeout=6) as client:
        response = await client.get(f'{PET_ORIGIN}/api/pet/device/settings', headers=headers)
    if response.status_code >= 400:
        raise HTTPException(401, 'Invalid device credentials')
    return device_id


async def token_for(request: Request, device_id: str) -> str:
    async with httpx.AsyncClient(timeout=6) as client:
        response = await client.post(f'{PET_ORIGIN}/api/pet/devices/{device_id}/watch-token', headers=cookie_header(request))
    if response.status_code >= 400:
        raise HTTPException(response.status_code, 'Archive authorization failed')
    token = (response.json() or {}).get('token')
    if not token:
        raise HTTPException(502, 'Archive token unavailable')
    return token


def talk_key(device_id: str) -> str:
    return f'pet:talkwake:{device_id}'


def validate_start(start: str) -> datetime:
    try:
        return datetime.fromisoformat(start.replace('Z', '+00:00'))
    except ValueError as exc:
        raise HTTPException(400, 'Invalid recording timestamp') from exc


def cache_name(device_id: str, start: str, duration: float) -> str:
    raw = f'{device_id}|{start}|{duration:.3f}'.encode()
    return hashlib.sha256(raw).hexdigest() + '.mp4'


def cleanup_cache() -> None:
    cutoff = time.time() - CACHE_TTL_SECONDS
    try:
        for path in CACHE_DIR.glob('*.mp4'):
            try:
                if path.stat().st_mtime < cutoff:
                    path.unlink(missing_ok=True)
            except OSError:
                pass
    except OSError:
        pass


async def ensure_playable_mp4(request: Request, device_id: str, start: str, duration: float) -> Path:
    """Materialize MediaMTX playback as a complete MP4 before serving it.

    Android WebView and several desktop players request byte ranges while reading
    MP4 metadata. Passing a chunked MediaMTX response straight through caused a
    permanent 0:00 player on those clients. A private temporary file lets
    Starlette/FileResponse provide Content-Length and proper HTTP Range/206.
    """
    validate_start(start)
    duration = max(.1, min(float(duration), 3600))
    key = cache_name(device_id, start, duration)
    final_path = CACHE_DIR / key
    if final_path.exists() and final_path.stat().st_size > 1024:
        return final_path

    lock = _cache_locks.setdefault(key, asyncio.Lock())
    async with lock:
        if final_path.exists() and final_path.stat().st_size > 1024:
            return final_path

        token = await token_for(request, device_id)
        temp_path = CACHE_DIR / (key + '.part')
        temp_path.unlink(missing_ok=True)
        client = httpx.AsyncClient(timeout=httpx.Timeout(20.0, read=None))
        try:
            upstream_request = client.build_request(
                'GET',
                f'{PLAYBACK_ORIGIN}/get',
                params={
                    'path': f'cam/{device_id}',
                    'start': start,
                    'duration': duration,
                    'format': 'mp4',
                },
                headers={'Authorization': f'Bearer {token}'},
            )
            upstream = await client.send(upstream_request, stream=True)
            if upstream.status_code >= 400:
                status = upstream.status_code
                await upstream.aclose()
                if status == 404:
                    raise HTTPException(404, 'Recording not found')
                raise HTTPException(502, 'Archive conversion failed')

            with temp_path.open('wb') as out:
                async for chunk in upstream.aiter_bytes(256 * 1024):
                    if chunk:
                        out.write(chunk)
            await upstream.aclose()
        except HTTPException:
            temp_path.unlink(missing_ok=True)
            raise
        except Exception as exc:
            temp_path.unlink(missing_ok=True)
            raise HTTPException(502, 'Archive stream unavailable') from exc
        finally:
            await client.aclose()

        if not temp_path.exists() or temp_path.stat().st_size < 1024:
            temp_path.unlink(missing_ok=True)
            raise HTTPException(502, 'Archive file is incomplete')

        with temp_path.open('rb') as fh:
            head = fh.read(64)
        if b'ftyp' not in head:
            temp_path.unlink(missing_ok=True)
            raise HTTPException(502, 'Archive codec is not playable')

        os.replace(temp_path, final_path)
        cleanup_cache()
        return final_path


@app.get('/health')
def health():
    return {'ok': True, 'service': 'camcam-pet-archive'}


@app.post('/api/pet/devices/{device_id}/talk-wake')
async def talk_wake(device_id: str, request: Request):
    await authorize(request, device_id)
    if redis_client:
        try:
            redis_client.rpush(talk_key(device_id), '1')
            redis_client.expire(talk_key(device_id), 120)
        except Exception:
            pass
    return {'ok': True}


@app.get('/api/pet/device/talk-wait')
async def talk_wait(request: Request):
    device_id = await authorize_device(request)
    if not redis_client:
        await asyncio.sleep(5)
        return {'wake': False}
    try:
        result = await asyncio.to_thread(redis_client.blpop, talk_key(device_id), 25)
        return {'wake': bool(result)}
    except Exception:
        await asyncio.sleep(3)
        return {'wake': False}


@app.get('/api/pet/devices/{device_id}/recordings')
async def recordings(device_id: str, request: Request):
    await authorize(request, device_id)
    token = await token_for(request, device_id)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f'{PLAYBACK_ORIGIN}/list',
                params={'path': f'cam/{device_id}'},
                headers={'Authorization': f'Bearer {token}'},
            )
        if response.status_code == 404:
            return []
        response.raise_for_status()
        spans = response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, 'Archive playback index unavailable') from exc
    except Exception as exc:
        raise HTTPException(502, 'Archive playback index unavailable') from exc
    if not isinstance(spans, list):
        return []

    rows = []
    for span in sorted(spans, key=lambda x: x.get('start') or '', reverse=True)[:300]:
        start = span.get('start')
        try:
            duration = float(span.get('duration') or 0)
        except Exception:
            duration = 0
        if not start or duration <= 0:
            continue
        try:
            validate_start(start)
        except HTTPException:
            continue
        query = urlencode({'start': start, 'duration': min(duration, 3600)})
        rows.append({'created_at': start, 'duration': duration, 'url': f'/pet-archive/{device_id}/view?{query}'})
    return rows


@app.get('/pet-archive/{device_id}/view')
async def view(device_id: str, request: Request, start: str, duration: float):
    await authorize(request, device_id)
    validate_start(start)
    duration = max(.1, min(float(duration), 3600))
    query = urlencode({'start': start, 'duration': duration})
    media_url = f'/pet-archive/{device_id}/media?{query}'
    page = f'''<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#102b2a"><title>CamCam Pet — آرشیو</title><style>*{{box-sizing:border-box}}html,body{{margin:0;background:#0b1716;color:#fff;font-family:Tahoma,Arial,sans-serif;min-height:100%}}.wrap{{min-height:100vh;display:grid;grid-template-rows:auto 1fr auto;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom))}}.top{{display:flex;justify-content:space-between;align-items:center;padding:6px 0 12px}}button{{border:1px solid #36514d;background:#132e2b;color:#fff;padding:9px 12px;border-radius:11px;font:inherit}}.player{{display:grid;place-items:center;min-height:0}}video{{width:100%;height:100%;max-height:78vh;object-fit:contain;background:#000;border-radius:15px}}.actions{{display:flex;gap:8px;padding-top:10px;align-items:center}}.primary{{background:#0d6b66;border-color:#0d6b66}}video:fullscreen{{width:100vw;height:100vh;max-height:none;border-radius:0}}small{{color:#9eb4b0}}#state{{font-size:12px;color:#9eb4b0}}</style></head><body><div class="wrap"><div class="top"><div><b>🐾 آرشیو پت</b><br><small>{html.escape(start)}</small></div><button onclick="history.back()">بازگشت</button></div><div class="player"><video id="v" controls autoplay playsinline preload="metadata" src="{html.escape(media_url)}"></video></div><div class="actions"><button class="primary" onclick="full()">⛶ تمام‌صفحه</button><span id="state">در حال آماده‌سازی ویدئو…</span></div></div><script>const v=document.getElementById('v'),s=document.getElementById('state');async function full(){{try{{if(v.requestFullscreen)await v.requestFullscreen();else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen()}}catch(e){{}}}}v.addEventListener('dblclick',full);v.addEventListener('loadedmetadata',()=>{{s.textContent='آماده پخش · '+Math.round(v.duration)+' ثانیه'}});v.addEventListener('playing',()=>{{s.textContent='در حال پخش'}});v.addEventListener('error',()=>{{s.textContent='این فایل قابل پخش نیست؛ یک بار برگرد و دوباره امتحان کن.'}});</script></body></html>'''
    return HTMLResponse(page, headers={'Cache-Control': 'private, no-store'})


@app.get('/pet-archive/{device_id}/media')
async def media(device_id: str, request: Request, start: str, duration: float):
    # Authorization is intentionally checked on every media/range request. The
    # cached MP4 itself is never exposed as a public/static path.
    await authorize(request, device_id)
    validate_start(start)
    duration = max(.1, min(float(duration), 3600))
    path = await ensure_playable_mp4(request, device_id, start, duration)

    stamp = 'pet'
    try:
        stamp = datetime.fromisoformat(start.replace('Z', '+00:00')).astimezone(timezone.utc).strftime('%Y%m%d-%H%M%S')
    except Exception:
        pass

    return FileResponse(
        path,
        media_type='video/mp4',
        filename=f'camcam-pet-{stamp}.mp4',
        content_disposition_type='inline',
        headers={
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'Accept-Ranges': 'bytes',
        },
    )
