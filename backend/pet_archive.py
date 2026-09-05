from __future__ import annotations

import html
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse

PET_ORIGIN = 'http://pet:8020'
PLAYBACK_ORIGIN = 'http://mediamtx:9996'
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


async def token_for(request: Request, device_id: str) -> str:
    async with httpx.AsyncClient(timeout=6) as client:
        response = await client.post(f'{PET_ORIGIN}/api/pet/devices/{device_id}/watch-token', headers=cookie_header(request))
    if response.status_code >= 400:
        raise HTTPException(response.status_code, 'Archive authorization failed')
    token = (response.json() or {}).get('token')
    if not token:
        raise HTTPException(502, 'Archive token unavailable')
    return token


@app.get('/health')
def health():
    return {'ok': True, 'service': 'camcam-pet-archive'}


@app.get('/api/pet/devices/{device_id}/recordings')
async def recordings(device_id: str, request: Request):
    await authorize(request, device_id)
    token = await token_for(request, device_id)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f'{PLAYBACK_ORIGIN}/list', params={'path': f'cam/{device_id}'}, headers={'Authorization': f'Bearer {token}'})
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
        query = urlencode({'start': start, 'duration': min(duration, 3600)})
        rows.append({'created_at': start, 'duration': duration, 'url': f'/pet-archive/{device_id}/view?{query}'})
    return rows


@app.get('/pet-archive/{device_id}/view')
async def view(device_id: str, request: Request, start: str, duration: float):
    await authorize(request, device_id)
    duration = max(.1, min(float(duration), 3600))
    query = urlencode({'start': start, 'duration': duration})
    media_url = f'/pet-archive/{device_id}/media?{query}'
    page = f'''<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#102b2a"><title>CamCam Pet — آرشیو</title><style>*{{box-sizing:border-box}}html,body{{margin:0;background:#0b1716;color:#fff;font-family:Tahoma,Arial,sans-serif;min-height:100%}}.wrap{{min-height:100vh;display:grid;grid-template-rows:auto 1fr auto;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom))}}.top{{display:flex;justify-content:space-between;align-items:center;padding:6px 0 12px}}button{{border:1px solid #36514d;background:#132e2b;color:#fff;padding:9px 12px;border-radius:11px;font:inherit}}.player{{display:grid;place-items:center;min-height:0}}video{{width:100%;height:100%;max-height:78vh;object-fit:contain;background:#000;border-radius:15px}}.actions{{display:flex;gap:8px;padding-top:10px}}.primary{{background:#0d6b66;border-color:#0d6b66}}video:fullscreen{{width:100vw;height:100vh;max-height:none;border-radius:0}}small{{color:#9eb4b0}}</style></head><body><div class="wrap"><div class="top"><div><b>🐾 آرشیو پت</b><br><small>{html.escape(start)}</small></div><button onclick="history.back()">بازگشت</button></div><div class="player"><video id="v" controls autoplay playsinline preload="metadata" src="{html.escape(media_url)}"></video></div><div class="actions"><button class="primary" onclick="full()">⛶ تمام‌صفحه</button></div></div><script>const v=document.getElementById('v');async function full(){{try{{if(v.requestFullscreen)await v.requestFullscreen();else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen()}}catch(e){{}}}}v.addEventListener('dblclick',full)</script></body></html>'''
    return HTMLResponse(page, headers={'Cache-Control': 'private, no-store'})


@app.get('/pet-archive/{device_id}/media')
async def media(device_id: str, request: Request, start: str, duration: float):
    await authorize(request, device_id)
    token = await token_for(request, device_id)
    duration = max(.1, min(float(duration), 3600))
    client = httpx.AsyncClient(timeout=httpx.Timeout(15.0, read=None))
    try:
        upstream_request = client.build_request('GET', f'{PLAYBACK_ORIGIN}/get', params={'path': f'cam/{device_id}', 'start': start, 'duration': duration, 'format': 'mp4'}, headers={'Authorization': f'Bearer {token}'})
        upstream = await client.send(upstream_request, stream=True)
    except Exception as exc:
        await client.aclose()
        raise HTTPException(502, 'Archive stream unavailable') from exc
    if upstream.status_code >= 400:
        status = upstream.status_code
        await upstream.aclose(); await client.aclose()
        if status == 404:
            raise HTTPException(404, 'Recording not found')
        raise HTTPException(502, 'Archive conversion failed')

    async def body():
        try:
            async for chunk in upstream.aiter_bytes(64 * 1024):
                if chunk:
                    yield chunk
        finally:
            await upstream.aclose(); await client.aclose()

    stamp = 'pet'
    try:
        stamp = datetime.fromisoformat(start.replace('Z', '+00:00')).astimezone(timezone.utc).strftime('%Y%m%d-%H%M%S')
    except Exception:
        pass
    headers = {'Cache-Control': 'private, no-store', 'Content-Disposition': f'inline; filename="camcam-pet-{stamp}.mp4"', 'X-Content-Type-Options': 'nosniff'}
    if upstream.headers.get('content-length'):
        headers['Content-Length'] = upstream.headers['content-length']
    return StreamingResponse(body(), media_type='video/mp4', headers=headers)
