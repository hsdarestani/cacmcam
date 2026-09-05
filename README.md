# CamCam

CamCam turns a spare phone into a secure cloud-connected camera and provides a multi-tenant SaaS dashboard for live view, motion events, recordings and subscriptions.

Production URL: **https://camcam.smarbiz.sbs**

## Current MVP

- Email/password accounts with Argon2 password hashing
- 7-day trial
- Multi-tenant camera ownership and plan limits
- One-time 8-digit pairing codes (10 minute TTL)
- Per-device 256-bit-class random publish credentials stored only as SHA-256 hashes
- WebRTC WHIP publishing from the phone browser/PWA
- WebRTC WHEP viewing with 10-minute viewer JWTs
- MediaMTX external HTTP authorization for every publish/read operation
- Live device heartbeat / online state
- Lightweight on-device motion detection and event timeline
- Server-side fMP4 recording with plan-based retention cleanup
- Protected recording list/download endpoints
- Starter and Pro monthly/yearly subscriptions
- Zibal request → redirect → verify payment flow
- Idempotent subscription activation
- Admin aggregate stats endpoint
- Caddy HTTPS reverse proxy and Docker Compose deployment
- PWA shell for dashboard and camera mode

## Architecture

`Phone/PWA → HTTPS + WebRTC → Caddy → MediaMTX → recordings`

`Dashboard → Caddy → FastAPI → PostgreSQL / Redis`

MediaMTX delegates stream authorization to the private FastAPI endpoint over the Docker network. `/internal/*` is blocked at the public reverse proxy.

## Required production secrets

GitHub Actions:

- `HOST` — deployment server host/IP
- `PASS` — SSH password
- `ZIBAL_MERCHANT` — Zibal merchant identifier (required for paid checkout)

Optional:

- `USER` — SSH user; defaults to `root`
- `PORT` — SSH port; defaults to `22`
- `ADMIN_EMAILS` — comma-separated emails allowed to access `/api/admin/stats`

The first deployment generates `SECRET_KEY` and `DB_PASSWORD` directly on the server and keeps them in `/opt/camcam/.env` with mode `600`.

## Plans

Default amounts are environment-configurable and are intentionally kept outside application logic:

- Starter: 3 cameras, 7-day recording retention
- Pro: 10 cameras, 30-day recording retention
- Trial: 1 camera, 1-day recording retention for 7 days

All amounts sent to Zibal are in IRR.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`. The server needs Docker Engine, Docker Compose v2, Git and ports 80/443 plus WebRTC ICE port 8189 TCP/UDP reachable.

The DNS record for `camcam.smarbiz.sbs` must resolve to the deployment server before Caddy can obtain a TLS certificate.

## Security notes

- No raw public RTSP/RTMP endpoint is exposed.
- Stream read tokens expire after 10 minutes.
- Pair codes are short-lived and single-use.
- Device secrets are never stored in plaintext in PostgreSQL.
- User session cookies are `HttpOnly`, `Secure` and `SameSite=Strict` in production.
- Origin checks are enforced for browser mutations.
- Login, registration and pairing have Redis-backed rate limits.
- Payment callbacks never trust callback query parameters as proof of payment; Zibal server-side verification is required.
- Recording file access always checks camera ownership and prevents path traversal.

## Camera browser limitation

The PWA uses Screen Wake Lock when available. Some mobile operating systems suspend browser camera capture when the device is fully locked. For unattended 24/7 installs, a native Android camera client is the next production client while keeping the same pairing, device-token and WHIP backend APIs.
