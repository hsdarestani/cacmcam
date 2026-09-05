from __future__ import annotations

import html
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse

APP_ORIGIN = "http://api:8000"
PLAYBACK_ORIGIN = "http://mediamtx:9996"
WEB = Path("/app/web")

app = FastAPI(title="CamCam archive gateway", docs_url=None, redoc_url=None, openapi_url=None)


def session_cookie(request: Request) -> str:
    cookie = request.headers.get("cookie", "")
    if not cookie:
        raise HTTPException(401, "Authentication required")
    return cookie


async def authorized_recording_rows(request: Request, device_id: str) -> list[dict]:
    """Reuse the main API as the ownership/authentication authority."""
    headers = {"cookie": session_cookie(request)}
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.get(f"{APP_ORIGIN}/api/devices/{device_id}/recordings", headers=headers)
    if response.status_code == 401:
        raise HTTPException(401, "Authentication required")
    if response.status_code == 404:
        raise HTTPException(404, "Camera not found")
    if response.status_code >= 400:
        raise HTTPException(response.status_code, "Archive access denied")
    try:
        payload = response.json()
        return payload if isinstance(payload, list) else []
    except Exception as exc:
        raise HTTPException(502, "Archive index unavailable") from exc


async def watch_token(request: Request, device_id: str) -> str:
    headers = {"cookie": session_cookie(request)}
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.post(f"{APP_ORIGIN}/api/devices/{device_id}/watch-token", headers=headers)
    if response.status_code == 401:
        raise HTTPException(401, "Authentication required")
    if response.status_code == 402:
        raise HTTPException(402, "Subscription inactive")
    if response.status_code == 404:
        raise HTTPException(404, "Camera not found")
    if response.status_code >= 400:
        raise HTTPException(response.status_code, "Archive authorization failed")
    token = (response.json() or {}).get("token")
    if not token:
        raise HTTPException(502, "Archive token unavailable")
    return token


def patched_index() -> str:
    source = (WEB / "index.html").read_text(encoding="utf-8")
    source = source.replace(
        '<a class="btn small" href="${esc(r.url)}" target="_blank">پخش</a>',
        '<a class="btn small" href="${esc(r.url)}">پخش</a>',
    )
    return source


def patched_camera() -> str:
    source = (WEB / "camera.html").read_text(encoding="utf-8")
    patch = r"""
<script>
(()=>{
  const originalCreateOffer = RTCPeerConnection.prototype.createOffer;
  RTCPeerConnection.prototype.createOffer = function(...args){
    try{
      const caps = window.RTCRtpSender?.getCapabilities?.('video');
      const codecs = caps?.codecs || [];
      const h264 = codecs.filter(c => (c.mimeType || '').toLowerCase() === 'video/h264');
      if(h264.length){
        const others = codecs.filter(c => (c.mimeType || '').toLowerCase() !== 'video/h264');
        const tx = this.getTransceivers().find(t => t.sender?.track?.kind === 'video');
        if(tx?.setCodecPreferences) tx.setCodecPreferences([...h264, ...others]);
      }
    }catch(e){ console.debug('codec preference unavailable', e); }
    return originalCreateOffer.apply(this,args);
  };
})();
</script>
"""
    return source.replace("</body>", patch + "</body>")


@app.get("/health")
def health():
    return {"ok": True, "service": "camcam-archive"}


@app.get("/")
def shell():
    return HTMLResponse(patched_index(), headers={"Cache-Control": "no-store"})


@app.get("/camera")
def camera_shell():
    return HTMLResponse(patched_camera(), headers={"Cache-Control": "no-store"})


@app.get("/api/devices/{device_id}/recordings")
async def recordings(device_id: str, request: Request):
    legacy_rows = await authorized_recording_rows(request, device_id)
    token = await watch_token(request, device_id)
    params = {"path": f"cam/{device_id}"}
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(f"{PLAYBACK_ORIGIN}/list", params=params, headers=headers)
        response.raise_for_status()
        spans = response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return []
        raise HTTPException(502, "Archive playback index unavailable") from exc
    except Exception as exc:
        raise HTTPException(502, "Archive playback index unavailable") from exc

    if not isinstance(spans, list):
        return []

    spans = sorted(spans, key=lambda item: item.get("start") or "", reverse=True)[:300]
    rows = []
    for index, span in enumerate(spans):
        start = span.get("start")
        try:
            duration = float(span.get("duration") or 0)
        except Exception:
            duration = 0.0
        if not start or duration <= 0:
            continue
        size = 0
        if index < len(legacy_rows):
            try:
                size = int(legacy_rows[index].get("size") or 0)
            except Exception:
                size = 0
        query = urlencode({"start": start, "duration": min(duration, 3600.0)})
        rows.append({
            "path": start,
            "size": size,
            "created_at": start,
            "duration": duration,
            "url": f"/archive/{device_id}/view?{query}",
        })
    return rows


@app.get("/archive/{device_id}/view")
async def archive_view(device_id: str, request: Request, start: str, duration: float):
    await authorized_recording_rows(request, device_id)
    duration = max(0.1, min(float(duration), 3600.0))
    query = urlencode({"start": start, "duration": duration})
    safe_start = html.escape(start)
    media_url = f"/archive/{device_id}/media?{query}"
    page = f"""<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0d5f5b"><title>CamCam — آرشیو</title><style>
*{{box-sizing:border-box}}html,body{{margin:0;background:#f6f0e6;color:#173c3a;font-family:Tahoma,Arial,sans-serif;min-height:100%;}}body{{min-height:100vh}}.wrap{{max-width:980px;margin:auto;padding:max(18px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left))}}.top{{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}}button{{font:inherit;border:1px solid #d9d1c3;background:#fffdf8;color:#173c3a;padding:10px 15px;border-radius:13px;font-weight:700;cursor:pointer}}.card{{background:#fffaf2;border:1px solid #d9d1c3;border-radius:22px;padding:14px;box-shadow:0 12px 35px rgba(30,67,63,.10)}}.player{{position:relative;background:#102b2a;border-radius:16px;overflow:hidden}}video{{display:block;width:100%;max-height:75vh;background:#000;object-fit:contain}}.actions{{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}}.fullscreen{{background:#0d6b66;border-color:#0d6b66;color:white}}small{{color:#6b7e79}}.note{{margin-top:10px;color:#6b7e79;font-size:13px;line-height:1.8}}video:fullscreen{{width:100vw;height:100vh;max-height:none;object-fit:contain;background:#000}}video:-webkit-full-screen{{width:100vw;height:100vh;max-height:none;object-fit:contain;background:#000}}@media(orientation:landscape) and (max-height:600px){{.wrap{{padding:8px}}.top,.note{{display:none}}.card{{padding:0;border:0;border-radius:0;background:#000}}.player,video{{border-radius:0;max-height:100vh}}.actions{{position:fixed;z-index:5;right:10px;bottom:10px;margin:0;opacity:.92}}}}
</style></head><body><div class="wrap"><div class="top"><div><b>آرشیو دوربین</b><br><small>{safe_start}</small></div><button onclick="history.back()">بازگشت</button></div><div class="card"><div class="player"><video id="archiveVideo" controls autoplay playsinline preload="metadata" src="{html.escape(media_url)}"></video></div><div class="actions"><button class="fullscreen" onclick="goFullscreen()">⛶ تمام‌صفحه</button><button onclick="history.back()">بازگشت</button></div><div class="note">برای دیدن راحت‌تر، تمام‌صفحه را بزن. در اپ اندروید، ویدئو در حالت تمام‌صفحه با چرخاندن گوشی به جهت درست Landscape می‌رود.</div></div></div><script>
const video=document.getElementById('archiveVideo');
async function lockLandscape(){{try{{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('landscape')}}catch(_e){{}}}}
function unlockOrientation(){{try{{if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock()}}catch(_e){{}}}}
async function goFullscreen(){{
  try{{
    if(video.requestFullscreen){{await video.requestFullscreen();}}
    else if(video.webkitRequestFullscreen){{video.webkitRequestFullscreen();}}
    else if(video.webkitEnterFullscreen){{video.webkitEnterFullscreen();}}
    await lockLandscape();
    video.play().catch(()=>{{}});
  }}catch(_e){{video.play().catch(()=>{{}});}}
}}
document.addEventListener('fullscreenchange',()=>{{if(document.fullscreenElement)lockLandscape();else unlockOrientation();}});
document.addEventListener('webkitfullscreenchange',()=>{{if(document.webkitFullscreenElement)lockLandscape();else unlockOrientation();}});
video.addEventListener('dblclick',goFullscreen);
</script></body></html>"""
    return HTMLResponse(page, headers={"Cache-Control": "private, no-store"})


@app.get("/archive/{device_id}/media")
async def archive_media(device_id: str, request: Request, start: str, duration: float):
    await authorized_recording_rows(request, device_id)
    token = await watch_token(request, device_id)
    duration = max(0.1, min(float(duration), 3600.0))
    params = {
        "path": f"cam/{device_id}",
        "start": start,
        "duration": duration,
        "format": "mp4",
    }
    client = httpx.AsyncClient(timeout=httpx.Timeout(15.0, read=None))
    try:
        upstream_request = client.build_request(
            "GET",
            f"{PLAYBACK_ORIGIN}/get",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        upstream = await client.send(upstream_request, stream=True)
    except Exception as exc:
        await client.aclose()
        raise HTTPException(502, "Archive stream unavailable") from exc

    if upstream.status_code >= 400:
        status = upstream.status_code
        await upstream.aclose()
        await client.aclose()
        if status == 404:
            raise HTTPException(404, "Recording not found")
        raise HTTPException(502, "Archive conversion failed")

    async def body():
        try:
            async for chunk in upstream.aiter_bytes(64 * 1024):
                if chunk:
                    yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    stamp = "recording"
    try:
        stamp = datetime.fromisoformat(start.replace("Z", "+00:00")).astimezone(timezone.utc).strftime("%Y%m%d-%H%M%S")
    except Exception:
        pass
    headers = {
        "Cache-Control": "private, no-store",
        "Content-Disposition": f'inline; filename="camcam-{stamp}.mp4"',
        "X-Content-Type-Options": "nosniff",
    }
    content_length = upstream.headers.get("content-length")
    if content_length:
        headers["Content-Length"] = content_length
    return StreamingResponse(body(), media_type="video/mp4", headers=headers)
