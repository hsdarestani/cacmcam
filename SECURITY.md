# CamCam security model

## Live stream transport

- Public signaling is only exposed through `https://camcam.smarbiz.sbs` and Caddy terminates TLS.
- MediaMTX is not exposed publicly on its HTTP/WebRTC signaling port; `/webrtc/*` is reverse-proxied through Caddy.
- WebRTC media is protected in transit with DTLS-SRTP. The public UDP/TCP ICE port carries encrypted WebRTC media, not a raw camera feed.
- Every camera publish requires its own high-entropy device credential. Only a SHA-256 digest of that credential is stored server-side.
- Every viewer requires a signed user/session plus a short-lived, camera-scoped watch token. Watch tokens expire after 60 seconds and include a unique `jti`.
- MediaMTX calls the private `/internal/mediamtx/auth` endpoint for publish/read authorization. Caddy explicitly blocks `/internal/*` from the public Internet.
- There is no anonymous stream-listing or public stream URL.

## User isolation

- Device, event, recording and live-view API operations are owner-scoped.
- Recordings are served through the authenticated API and are never mounted as a public static directory.
- Pair codes are short-lived, one-time and stored only as hashes.
- Login passwords are hashed with Argon2.
- Login/session cookies are `HttpOnly`, `Secure` and `SameSite=Strict`.
- State-changing browser requests are origin-checked.

## Admin security and privacy

- Admin eligibility is controlled by the `ADMIN_EMAILS` server secret.
- Admin actions require a separate short-lived step-up session created only after re-entering the account password.
- Sensitive admin actions are written to `audit_logs` with actor, target, time and source IP.
- The admin product intentionally has **no endpoint or UI action for watching another user's live camera**. It exposes operational metadata only: online state, storage, event counts, subscription and payment state.

## Important trust boundary

CamCam is protected against an outside observer reading the stream from the network or opening a guessed stream URL. It is **not server-blind end-to-end encryption**: MediaMTX receives the WebRTC stream because the server provides relaying and recording. A person with root access to the production host is therefore inside the trust boundary. Server host hardening, SSH access control, backups and secret management remain part of the production security model.
