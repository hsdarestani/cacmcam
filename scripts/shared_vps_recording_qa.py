"""Synthetic deployment acceptance: no real camera or payment is used."""
import asyncio, secrets, time, json, logging
import httpx
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack, RTCRtpSender
from av import VideoFrame
logging.getLogger("aiortc").setLevel(logging.ERROR)
BASE="https://camcam.smarbiz.sbs"

class Pattern(VideoStreamTrack):
    async def recv(self):
        pts,tb=await self.next_timestamp()
        frame=VideoFrame(320,240,"yuv420p")
        for i,p in enumerate(frame.planes):
            p.update(bytes([64+(pts//3000)%128 if i==0 else 128])*p.buffer_size)
        frame.pts=pts;frame.time_base=tb
        return frame

async def main():
    pc=RTCPeerConnection()
    async with httpx.AsyncClient(base_url=BASE,timeout=90,headers={"Origin":BASE}) as c:
        async def request(method,path,**kw):
            r=await c.request(method,path,**kw)
            if r.status_code>=400:
                raise RuntimeError(f"{method} {path.split('?')[0]} HTTP {r.status_code}")
            return r
        email="deployment-qa-"+str(int(time.time()))+"@example.com"
        password=secrets.token_urlsafe(24)
        await request("POST","/api/auth/register",json={"email":email,"password":password})
        session=c.cookies.get("camcam_session")
        assert session
        assert (await request("GET","/api/me")).json()["email"]==email
        print("PUBLIC_REGISTRATION_SECURE_SESSION_DATABASE_OK",flush=True)
        d=(await request("POST","/api/devices",json={"name":"Deployment QA synthetic camera"})).json()
        did=d["id"]
        pair=(await request("POST","/api/pair",json={"code":d["pairing_code"]})).json()
        device_token=pair["device_token"]
        await request("POST","/api/device/heartbeat",headers={"X-Device-Id":did,"X-Device-Token":device_token})
        print("CAMERA_CREATE_PAIR_HEARTBEAT_OK",flush=True)
        pc.addTrack(Pattern())
        # Match the production camera's preferH264 path: fMP4 cannot record VP8.
        codecs=RTCRtpSender.getCapabilities('video').codecs
        h264=[c for c in codecs if c.mimeType.lower()=='video/h264']
        assert h264, 'H264_ENCODER_UNAVAILABLE'
        pc.getTransceivers()[0].setCodecPreferences(h264)
        await pc.setLocalDescription(await pc.createOffer())
        resp=await request("POST",pair["whip_url"],headers={"Content-Type":"application/sdp","Authorization":"Basic "+__import__("base64").b64encode((did+":"+device_token).encode()).decode()},content=pc.localDescription.sdp)
        assert resp.status_code==201
        candidate_lines=[l for l in resp.text.splitlines() if l.startswith("a=candidate:")]
        print("WHIP_ACCEPTED_CANDIDATE_HAS_VPS_IP",any("143.20.60.195" in l for l in candidate_lines),flush=True)
        location=resp.headers.get("location")
        await pc.setRemoteDescription(RTCSessionDescription(resp.text,"answer"))
        try:
            for _ in range(30):
                if pc.connectionState in ("connected","failed"):break
                await asyncio.sleep(1)
            assert pc.connectionState=="connected", "WEBRTC_CONNECTION_"+pc.connectionState
            print("PUBLIC_WEBRTC_SYNTHETIC_VIDEO_CONNECTED",flush=True)
            await asyncio.sleep(8)
        finally:
            await pc.close()
        if location:
            await c.delete(location,headers={"Authorization":"Basic "+__import__("base64").b64encode((did+":"+device_token).encode()).decode()})
        rows=[]
        for _ in range(12):
            rows=(await request("GET",f"/api/pet/devices/{did}/recordings")).json()
            if rows:break
            await asyncio.sleep(2)
        assert rows, "RECORDED_VIDEO_NOT_IN_ARCHIVE"
        row=rows[0]
        from urllib.parse import urlencode
        q=urlencode({"start":row["created_at"],"duration":min(row["duration"],5)})
        media=await request("GET",f"/pet-archive/{did}/media?"+q)
        assert len(media.content)>500 and b"ftyp" in media.content[:64]
        from pathlib import Path
        import subprocess
        Path("/tmp/camcam-synthetic-qa.mp4").write_bytes(media.content)
        info=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-of","json","/tmp/camcam-synthetic-qa.mp4"]))
        assert any(s["codec_type"]=="video" and int(s["width"])==320 for s in info["streams"])
        print("RECORDED_VIDEO_ARCHIVE_DOWNLOAD_AND_DECODE_OK",flush=True)
        async with httpx.AsyncClient(base_url=BASE,timeout=20) as outsider:
            r=await outsider.get(f"/pet-archive/{did}/media?"+q)
            assert r.status_code in (401,403)
        await request("POST","/api/auth/logout")
        assert (await c.get("/api/me")).status_code==401
        await request("POST","/api/auth/login",json={"email":email,"password":password})
        assert (await c.get("/api/me")).status_code==200
        print("ARCHIVE_ACCESS_ISOLATION_LOGOUT_AND_RELOGIN_OK",flush=True)
        print("CAMCAM_REAL_SYNTHETIC_RECORDING_ACCEPTANCE_PASSED",flush=True)

try:
    asyncio.run(main())
except Exception as e:
    print("CAMCAM_QA_FAILED",type(e).__name__,str(e)[:180],flush=True)
    raise SystemExit(1)
