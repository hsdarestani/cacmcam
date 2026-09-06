from __future__ import annotations

from fastapi.responses import FileResponse, RedirectResponse

from app import WEB, app


NO_CACHE = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
}


# The public web entrypoints are also served directly by Caddy. These FastAPI
# routes are a defensive fallback for any request that reaches the API because
# of an older/stale edge configuration. Remove the legacy root/camera handlers
# imported from app.py so the fallback cannot serve the old UI again.
_REPLACED_PATHS = {'/', '/camera'}
app.router.routes[:] = [
    route for route in app.router.routes
    if getattr(route, 'path', None) not in _REPLACED_PATHS
]


@app.get('/')
def public_landing():
    return FileResponse(WEB / 'landing.html', headers={**NO_CACHE, 'X-CamCam-Page': 'landing-api-v5'})


@app.get('/landing')
def public_landing_alias():
    return FileResponse(WEB / 'landing.html', headers={**NO_CACHE, 'X-CamCam-Page': 'landing-api-v5'})


@app.get('/refresh')
def refresh_browser_cache():
    return FileResponse(
        WEB / 'reset.html',
        headers={
            **NO_CACHE,
            'Clear-Site-Data': '"cache", "storage"',
            'X-CamCam-Page': 'cache-repair-v3',
        },
    )


@app.get('/pet')
def pet_app_page():
    return FileResponse(WEB / 'pet.html', headers=NO_CACHE)


@app.get('/camera')
def pet_camera_page():
    return FileResponse(WEB / 'pet_camera.html', headers=NO_CACHE)


@app.get('/sw.js')
def retired_service_worker():
    return FileResponse(
        WEB / 'sw.js',
        media_type='application/javascript',
        headers={**NO_CACHE, 'Service-Worker-Allowed': '/'},
    )


@app.get('/download/CamCam.apk')
def download_android_app():
    return RedirectResponse(
        'https://github.com/hsdarestani/cacmcam/releases/latest/download/CamCam-Test.apk',
        status_code=302,
        headers=NO_CACHE,
    )
