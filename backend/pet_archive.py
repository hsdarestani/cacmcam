from __future__ import annotations

import asyncio
import hashlib
import html
import json
import os
import subprocess
import time
import uuid
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
MAX_MANUAL_SECONDS = 60 * 60
CACHE_DIR.mkdir(parents=True, exist_ok=True)
_cache_locks: dict[str, asyncio.Lock] = {}
_mem_manual: dict[str, list[dict]] = {}

try:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=30)
except Exception:
    redis_client = None

app = FastAPI(title='CamCam Pet archive gateway', docs_url=None, redoc_url=None, openapi_url=None)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


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


def manual_key(device_id: str) -> str:
    return f'pet:manual:{device_id}'


def validate_start(start: str) -> datetime:
    try:
        value = datetime.fromisoformat(start.replace('Z', '+00:00'))
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    except ValueError as exc:
        raise HTTPException(400, 'Invalid recording timestamp') from exc


def cache_name(device_id: str, start: str, duration: float) -> str:
    raw = f'{device_id}|{start}|{duration:.3f}|compat-v2'.encode()
    return hashlib.sha256(raw).hexdigest() + '.mp4'


def cleanup_cache() -> None:
    cutoff = time.time() - CACHE_TTL_SECONDS
    try:
        for path in CACHE_DIR.glob('*'):
            if not path.is_file():
                continue
            try:
                if path.stat().st_mtime < cutoff:
                    path.unlink(missing_ok=True)
            except OSError:
                pass
    except OSError:
        pass


def probe_codecs(path: Path) -> tuple[str | None, str | None]:
    try:
        proc = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name', '-of', 'json', str(path)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=25,
        )
        streams = (json.loads(proc.stdout or '{}') or {}).get('streams') or []
        video = next((x.get('codec_name') for x in streams if x.get('codec_type') == 'video'), None)
        audio = next((x.get('codec_name') for x in streams if x.get('codec_type') == 'audio'), None)
        return video, audio
    except Exception:
        return None, None


def make_compatible_mp4(source: Path, target: Path) -> None:
    video, audio = probe_codecs(source)
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source)]
    if video == 'h264':
        cmd += ['-c:v', 'copy']
    else:
        cmd += ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p']
    if audio is None:
        cmd += ['-an']
    elif audio == 'aac':
        cmd += ['-c:a', 'copy']
    else:
        cmd += ['-c:a', 'aac', '-b:a', '96k', '-ac', '1']
    cmd += ['-movflags', '+faststart', str(target)]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=180)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        target.unlink(missing_ok=True)
        raise RuntimeError('ffmpeg compatibility conversion failed') from exc


async def ensure_playable_mp4(request: Request, device_id: str, start: str, duration: float) -> Path:
    """Fetch private MediaMTX playback and materialize a seekable, Android-safe MP4.

    MediaMTX can record VP8/VP9/H264 plus browser-oriented audio codecs depending
    on the publishing device. Android WebView is far less tolerant for archived
    MP4 than for WebRTC. The gateway therefore remuxes H264/AAC when possible and
    transcodes only unsupported tracks to H264/AAC. The private result is served
    by FileResponse so byte-range seeking works and is never exposed as static data.
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
        raw_path = CACHE_DIR / (key + '.raw.mp4')
        converted_path = CACHE_DIR / (key + '.converted.mp4')
        raw_path.unlink(missing_ok=True)
        converted_path.unlink(missing_ok=True)
        client = httpx.AsyncClient(timeout=httpx.Timeout(20.0, read=None))
        try:
            upstream_request = client.build_request(
                'GET',
                f'{PLAYBACK_ORIGIN}/get',
                params={'path': f'cam/{device_id}', 'start': start, 'duration': duration, 'format': 'mp4'},
                headers={'Authorization': f'Bearer {token}'},
            )
            upstream = await client.send(upstream_request, stream=True)
            if upstream.status_code >= 400:
                status = upstream.status_code
                await upstream.aclose()
                if status == 404:
                    raise HTTPException(404, 'Recording not found')
                raise HTTPException(502, 'Archive conversion failed')
            with raw_path.open('wb') as out:
                async for chunk in upstream.aiter_bytes(256 * 1024):
                    if chunk:
                        out.write(chunk)
            await upstream.aclose()
        except HTTPException:
            raw_path.unlink(missing_ok=True)
            raise
        except Exception as exc:
            raw_path.unlink(missing_ok=True)
            raise HTTPException(502, 'Archive stream unavailable') from exc
        finally:
            await client.aclose()

        if not raw_path.exists() or raw_path.stat().st_size < 1024:
            raw_path.unlink(missing_ok=True)
            raise HTTPException(502, 'Archive file is incomplete')
        with raw_path.open('rb') as fh:
            if b'ftyp' not in fh.read(128):
                raw_path.unlink(missing_ok=True)
                raise HTTPException(502, 'Archive container is not playable')

        try:
            await asyncio.to_thread(make_compatible_mp4, raw_path, converted_path)
        except Exception as exc:
            raw_path.unlink(missing_ok=True)
            converted_path.unlink(missing_ok=True)
            raise HTTPException(502, 'Archive codec conversion failed') from exc
        finally:
            raw_path.unlink(missing_ok=True)

        if not converted_path.exists() or converted_path.stat().st_size < 1024:
            converted_path.unlink(missing_ok=True)
            raise HTTPException(502, 'Archive compatibility file is incomplete')
        os.replace(converted_path, final_path)
        cleanup_cache()
        return final_path


def load_manual_rows(device_id: str) -> list[dict]:
    if redis_client:
        try:
            values = redis_client.lrange(manual_key(device_id), 0, 199) or []
            return [json.loads(v) for v in values]
        except Exception:
            pass
    return list(_mem_manual.get(device_id, []))


def save_manual_rows(device_id: str, rows: list[dict]) -> None:
    rows = rows[:200]
    if redis_client:
        try:
            pipe = redis_client.pipeline()
            pipe.delete(manual_key(device_id))
            if rows:
                pipe.rpush(manual_key(device_id), *[json.dumps(r, ensure_ascii=False) for r in rows])
                pipe.expire(manual_key(device_id), 60 * 60 * 24 * 35)
            pipe.execute()
            return
        except Exception:
            pass
    _mem_manual[device_id] = rows


def public_manual(row: dict, device_id: str) -> dict:
    item = dict(row)
    if item.get('ended_at'):
        start = item['started_at']
        duration = max(.1, min(float(item.get('duration') or 0), MAX_MANUAL_SECONDS))
        item['url'] = f'/pet-archive/{device_id}/view?' + urlencode({'start': start, 'duration': duration})
    else:
        item['url'] = None
    return item


@app.get('/health')
def health():
    return {'ok': True, 'service': 'camcam-pet-archive', 'ffmpeg': True}


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


@app.post('/api/pet/devices/{device_id}/manual-recordings/start')
async def manual_start(device_id: str, request: Request):
    await authorize(request, device_id)
    rows = load_manual_rows(device_id)
    active = next((r for r in rows if not r.get('ended_at')), None)
    if active:
        return public_manual(active, device_id)
    row = {'id': uuid.uuid4().hex, 'started_at': utcnow().isoformat(), 'ended_at': None, 'duration': None}
    rows.insert(0, row)
    save_manual_rows(device_id, rows)
    return public_manual(row, device_id)


@app.post('/api/pet/devices/{device_id}/manual-recordings/{recording_id}/stop')
async def manual_stop(device_id: str, recording_id: str, request: Request):
    await authorize(request, device_id)
    rows = load_manual_rows(device_id)
    row = next((r for r in rows if r.get('id') == recording_id), None)
    if not row:
        raise HTTPException(404, 'Manual recording not found')
    if not row.get('ended_at'):
        start_dt = validate_start(row['started_at'])
        end_dt = utcnow()
        duration = max(.1, min((end_dt - start_dt).total_seconds(), MAX_MANUAL_SECONDS))
        row['ended_at'] = end_dt.isoformat()
        row['duration'] = duration
        save_manual_rows(device_id, rows)
    return public_manual(row, device_id)


@app.get('/api/pet/devices/{device_id}/manual-recordings')
async def manual_recordings(device_id: str, request: Request):
    await authorize(request, device_id)
    return [public_manual(r, device_id) for r in load_manual_rows(device_id)]


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
    page = f'''<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#102b2a"><title>CamCam Pet — آرشیو</title><style>*{{box-sizing:border-box}}html,body{{margin:0;background:#0b1716;color:#fff;font-family:Tahoma,Arial,sans-serif;min-height:100%}}.wrap{{min-height:100vh;display:grid;grid-template-rows:auto 1fr auto;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom))}}.top{{display:flex;justify-content:space-between;align-items:center;padding:6px 0 12px}}button{{border:1px solid #36514d;background:#132e2b;color:#fff;padding:9px 12px;border-radius:11px;font:inherit}}.player{{display:grid;place-items:center;min-height:0}}video{{width:100%;height:100%;max-height:78vh;object-fit:contain;background:#000;border-radius:15px}}.actions{{display:flex;gap:8px;padding-top:10px;align-items:center}}.primary{{background:#0d6b66;border-color:#0d6b66}}video:fullscreen{{width:100vw;height:100vh;max-height:none;border-radius:0}}small,#state{{color:#9eb4b0;font-size:12px}}</style></head><body><div class="wrap"><div class="top"><div><b>🐾 آرشیو پت</b><br><small>{html.escape(start)}</small></div><button onclick="history.back()">بازگشت</button></div><div class="player"><video id="v" controls autoplay playsinline preload="metadata" src="{html.escape(media_url)}"></video></div><div class="actions"><button class="primary" onclick="full()">⛶ تمام‌صفحه</button><span id="state">در حال تبدیل سازگار ویدئو…</span></div></div><script>const v=document.getElementById('v'),s=document.getElementById('state');async function full(){{try{{if(v.requestFullscreen)await v.requestFullscreen();else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen()}}catch(e){{}}}}v.addEventListener('dblclick',full);v.addEventListener('loadedmetadata',()=>{{s.textContent='آماده پخش · '+Math.round(v.duration)+' ثانیه'}});v.addEventListener('playing',()=>{{s.textContent='در حال پخش'}});v.addEventListener('error',()=>{{s.textContent='تبدیل یا پخش این کلیپ ناموفق بود.'}});</script></body></html>'''
    return HTMLResponse(page, headers={'Cache-Control': 'private, no-store'})


@app.get('/pet-archive/{device_id}/media')
async def media(device_id: str, request: Request, start: str, duration: float):
    await authorize(request, device_id)
    validate_start(start)
    duration = max(.1, min(float(duration), 3600))
    path = await ensure_playable_mp4(request, device_id, start, duration)
    stamp = 'pet'
    try:
        stamp = validate_start(start).strftime('%Y%m%d-%H%M%S')
    except Exception:
        pass
    return FileResponse(
        path,
        media_type='video/mp4',
        filename=f'camcam-pet-{stamp}.mp4',
        content_disposition_type='inline',
        headers={'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes'},
    )
