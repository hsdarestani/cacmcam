from __future__ import annotations

import secrets
from datetime import datetime
from typing import AsyncIterator
from urllib.parse import quote

import httpx
from fastapi import Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import app, User, current_user, get_db, make_jwt, owned_device, record_root


PLAYBACK_BASE = "http://mediamtx:9996"
_RECORD_LIST_PATH = "/api/devices/{device_id}/recordings"
_RECORD_FILE_PATH = "/api/devices/{device_id}/recordings/{recording_path:path}"

# Replace the legacy raw-file archive routes. Raw fMP4 recording segments are
# intentionally not sent directly to clients anymore; MediaMTX remuxes them
# to a normal MP4 stream first, which is much more compatible with browsers
# and desktop/mobile players.
app.router.routes[:] = [
    route
    for route in app.router.routes
    if getattr(route, "path", None) not in {_RECORD_LIST_PATH, _RECORD_FILE_PATH}
]


def playback_token(user: User, device_id: str) -> str:
    return make_jwt(
        {
            "sub": user.id,
            "device_id": device_id,
            "scope": "watch",
            "purpose": "webrtc-read",
            "jti": secrets.token_urlsafe(18),
        },
        seconds=45,
    )


def playback_headers(user: User, device_id: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {playback_token(user, device_id)}"}


def raw_recording_sizes(device_id: str) -> list[int]:
    base = record_root(device_id)
    if not base.exists():
        return []
    files = sorted(
        (p for p in base.rglob("*") if p.is_file()),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return [p.stat().st_size for p in files]


@app.get(_RECORD_LIST_PATH)
async def recordings(
    device_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    owned_device(db, user, device_id)
    path_name = f"cam/{device_id}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{PLAYBACK_BASE}/list",
                params={"path": path_name},
                headers=playback_headers(user, device_id),
            )
            response.raise_for_status()
            spans = response.json()
    except Exception as exc:
        raise HTTPException(502, "Archive service is temporarily unavailable") from exc

    if not isinstance(spans, list):
        return []

    def sort_key(item: dict) -> str:
        return str(item.get("start") or "")

    spans = sorted((s for s in spans if isinstance(s, dict)), key=sort_key, reverse=True)
    sizes = raw_recording_sizes(device_id)
    rows = []

    for index, span in enumerate(spans[:300]):
        start = str(span.get("start") or "").strip()
        try:
            duration = float(span.get("duration") or 0)
        except (TypeError, ValueError):
            duration = 0
        if not start or duration <= 0:
            continue

        try:
            created = datetime.fromisoformat(start.replace("Z", "+00:00"))
        except ValueError:
            continue

        rows.append(
            {
                "path": f"playback-{index}",
                "size": sizes[index] if index < len(sizes) else 0,
                "duration": duration,
                "created_at": created,
                "url": (
                    f"/api/devices/{device_id}/recordings/play"
                    f"?start={quote(start, safe='')}"
                    f"&duration={duration:.3f}"
                ),
            }
        )

    return rows


@app.get("/api/devices/{device_id}/recordings/play")
async def recording_play(
    device_id: str,
    start: str = Query(min_length=10, max_length=80),
    duration: float = Query(gt=0, le=3600),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    owned_device(db, user, device_id)

    try:
        datetime.fromisoformat(start.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(400, "Invalid recording timestamp") from exc

    client = httpx.AsyncClient(timeout=httpx.Timeout(20.0, read=None))
    request = client.build_request(
        "GET",
        f"{PLAYBACK_BASE}/get",
        params={
            "path": f"cam/{device_id}",
            "start": start,
            "duration": f"{duration:.3f}",
            "format": "mp4",
        },
        headers=playback_headers(user, device_id),
    )

    try:
        upstream = await client.send(request, stream=True)
    except Exception as exc:
        await client.aclose()
        raise HTTPException(502, "Could not prepare recording") from exc

    if upstream.status_code >= 400:
        status = upstream.status_code
        await upstream.aclose()
        await client.aclose()
        if status == 404:
            raise HTTPException(404, "Recording not found")
        raise HTTPException(502, "Could not prepare recording")

    async def body() -> AsyncIterator[bytes]:
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    safe_name = start.replace(":", "-").replace("+", "_")[:40]
    return StreamingResponse(
        body(),
        media_type="video/mp4",
        headers={
            "Cache-Control": "private, no-store",
            "Content-Disposition": f'inline; filename="CamCam-{safe_name}.mp4"',
            "X-Content-Type-Options": "nosniff",
        },
    )
