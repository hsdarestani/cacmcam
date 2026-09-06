from __future__ import annotations

import asyncio
import base64
import json
import os
import secrets
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Generator
from urllib.parse import quote, urlencode

import httpx
import jwt
import redis
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    base_url: str = 'https://camcam.smarbiz.sbs'
    secret_key: str = 'dev-only-change-me'
    database_url: str = 'sqlite:///./camcam.db'
    redis_url: str = 'redis://localhost:6379/0'
    watch_token_seconds: int = 60


settings = Settings()
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
try:
    redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=1)
except Exception:
    redis_client = None


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = 'users'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    disabled: Mapped[bool] = mapped_column(Boolean, default=False)


class Device(Base):
    __tablename__ = 'devices'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(100))
    token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Subscription(Base):
    __tablename__ = 'subscriptions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    plan: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Event(Base):
    __tablename__ = 'events'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(String(36), index=True)
    kind: Mapped[str] = mapped_column(String(40), default='motion')
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class PetDeviceSetting(Base):
    __tablename__ = 'pet_device_settings'
    device_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    pet_name: Mapped[str] = mapped_column(String(80), default='')
    pet_type: Mapped[str] = mapped_column(String(20), default='other')
    motion_sensitivity: Mapped[str] = mapped_column(String(20), default='normal')
    sound_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sound_threshold: Mapped[int] = mapped_column(Integer, default=24)
    inactivity_minutes: Mapped[int] = mapped_column(Integer, default=120)
    quiet_start: Mapped[str | None] = mapped_column(String(5), nullable=True)
    quiet_end: Mapped[str | None] = mapped_column(String(5), nullable=True)
    low_power_default: Mapped[bool] = mapped_column(Boolean, default=False)
    quality: Mapped[str] = mapped_column(String(10), default='720p')
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PetCameraShare(Base):
    __tablename__ = 'pet_camera_shares'
    __table_args__ = (UniqueConstraint('device_id', 'user_id', name='uq_pet_share_device_user'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    role: Mapped[str] = mapped_column(String(20), default='caregiver')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SettingsBody(BaseModel):
    pet_name: str = Field(default='', max_length=80)
    pet_type: str = Field(default='other', pattern='^(dog|cat|other)$')
    motion_sensitivity: str = Field(default='normal', pattern='^(low|normal|high)$')
    sound_enabled: bool = True
    sound_threshold: int = Field(default=24, ge=8, le=80)
    inactivity_minutes: int = Field(default=120, ge=15, le=1440)
    quiet_start: str | None = Field(default=None, pattern='^([01]\\d|2[0-3]):[0-5]\\d$')
    quiet_end: str | None = Field(default=None, pattern='^([01]\\d|2[0-3]):[0-5]\\d$')
    low_power_default: bool = False
    quality: str = Field(default='720p', pattern='^(360p|720p|1080p)$')


class EventBody(BaseModel):
    kind: str = Field(default='motion', max_length=40)
    confidence: int | None = Field(default=None, ge=0, le=100)
    metadata: dict | None = None
    snapshot_data_url: str | None = Field(default=None, max_length=500_000)


class CommandBody(BaseModel):
    type: str = Field(pattern='^(torch|camera|zoom|quality|low_power|say)$')
    value: str | float | bool | int | None = None


class ShareBody(BaseModel):
    email: EmailStr
    role: str = Field(default='caregiver', pattern='^(viewer|caregiver)$')


class TelemetryBody(BaseModel):
    battery: int | None = Field(default=None, ge=0, le=100)
    charging: bool | None = None
    temperature_c: float | None = Field(default=None, ge=-20, le=100)
    low_power: bool = False
    torch: bool | None = None
    zoom: float | None = Field(default=None, ge=1, le=8)
    codec: str | None = Field(default=None, max_length=40)
    facing: str | None = Field(default=None, max_length=20)
    quality: str | None = Field(default=None, max_length=10)
    talk_connected: bool = False


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def sha(value: str) -> str:
    import hashlib
    return hashlib.sha256(value.encode()).hexdigest()


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=['HS256'])
    except jwt.PyJWTError as exc:
        raise HTTPException(401, 'Invalid or expired token') from exc


def make_token(payload: dict, seconds: int = 60) -> str:
    data = dict(payload)
    data['iat'] = utcnow()
    data['exp'] = utcnow() + timedelta(seconds=seconds)
    return jwt.encode(data, settings.secret_key, algorithm='HS256')


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get('camcam_session')
    if not token:
        raise HTTPException(401, 'Authentication required')
    data = decode_token(token)
    if data.get('scope') != 'session':
        raise HTTPException(401, 'Authentication required')
    user = db.get(User, data.get('sub'))
    if not user or user.disabled:
        raise HTTPException(401, 'Authentication required')
    return user


def owner_is_active(db: Session, owner_id: str) -> bool:
    user = db.get(User, owner_id)
    if not user or user.disabled:
        return False
    now = utcnow()
    sub = db.scalar(select(Subscription).where(Subscription.user_id == owner_id))
    if sub and sub.status == 'active' and sub.current_period_end and sub.current_period_end > now:
        return True
    return bool(user.trial_ends_at and user.trial_ends_at > now)


def share_for(db: Session, user_id: str, device_id: str) -> PetCameraShare | None:
    return db.scalar(select(PetCameraShare).where(PetCameraShare.user_id == user_id, PetCameraShare.device_id == device_id))


def authorized_device(db: Session, user: User, device_id: str, caregiver: bool = False) -> tuple[Device, str]:
    device = db.get(Device, device_id)
    if not device:
        raise HTTPException(404, 'Camera not found')
    if device.owner_id == user.id:
        return device, 'owner'
    share = share_for(db, user.id, device_id)
    if not share or (caregiver and share.role != 'caregiver'):
        raise HTTPException(403, 'Camera access denied')
    return device, share.role


def verify_device(db: Session, device_id: str | None, device_token: str | None) -> Device:
    if not device_id or not device_token:
        raise HTTPException(401, 'Device credentials required')
    device = db.get(Device, device_id)
    if not device or not device.token_hash or not secrets.compare_digest(device.token_hash, sha(device_token)):
        raise HTTPException(401, 'Invalid device credentials')
    if not owner_is_active(db, device.owner_id):
        raise HTTPException(402, 'Subscription inactive')
    return device


def get_setting(db: Session, device_id: str) -> PetDeviceSetting:
    row = db.get(PetDeviceSetting, device_id)
    if row:
        return row
    row = PetDeviceSetting(device_id=device_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def setting_dict(row: PetDeviceSetting) -> dict:
    return {
        'pet_name': row.pet_name,
        'pet_type': row.pet_type,
        'motion_sensitivity': row.motion_sensitivity,
        'sound_enabled': row.sound_enabled,
        'sound_threshold': row.sound_threshold,
        'inactivity_minutes': row.inactivity_minutes,
        'quiet_start': row.quiet_start,
        'quiet_end': row.quiet_end,
        'low_power_default': row.low_power_default,
        'quality': row.quality,
    }


def event_root(device_id: str) -> Path:
    return Path('/recordings/events') / device_id


def recording_root(device_id: str) -> Path:
    return Path('/recordings/cam') / device_id


def save_snapshot(device_id: str, event_id: str, data_url: str | None) -> str | None:
    if not data_url or ',' not in data_url:
        return None
    prefix, encoded = data_url.split(',', 1)
    if 'base64' not in prefix or 'image/jpeg' not in prefix:
        return None
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception:
        return None
    if not raw or len(raw) > 260_000:
        return None
    folder = event_root(device_id)
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f'{event_id}.jpg'
    target.write_bytes(raw)
    return f'/api/pet/devices/{device_id}/events/{event_id}/snapshot'


def telemetry_key(device_id: str) -> str:
    return f'pet:telemetry:{device_id}'


def command_key(device_id: str) -> str:
    return f'pet:commands:{device_id}'


MEM_COMMANDS: dict[str, list[dict]] = {}
MEM_TELEMETRY: dict[str, dict] = {}


def store_command(device_id: str, command: dict) -> None:
    payload = json.dumps(command, ensure_ascii=False)
    if redis_client:
        try:
            redis_client.rpush(command_key(device_id), payload)
            redis_client.ltrim(command_key(device_id), -50, -1)
            redis_client.expire(command_key(device_id), 3600)
            return
        except Exception:
            pass
    MEM_COMMANDS.setdefault(device_id, []).append(command)
    MEM_COMMANDS[device_id] = MEM_COMMANDS[device_id][-50:]


def pop_commands(device_id: str) -> list[dict]:
    if redis_client:
        try:
            values = redis_client.lpop(command_key(device_id), 20) or []
            if isinstance(values, str):
                values = [values]
            return [json.loads(v) for v in values]
        except Exception:
            pass
    values = MEM_COMMANDS.pop(device_id, [])
    return values[-20:]


def store_telemetry(device_id: str, body: TelemetryBody) -> None:
    data = body.model_dump()
    data['updated_at'] = utcnow().isoformat()
    if redis_client:
        try:
            redis_client.setex(telemetry_key(device_id), 300, json.dumps(data))
            return
        except Exception:
            pass
    MEM_TELEMETRY[device_id] = data


def load_telemetry(device_id: str) -> dict | None:
    if redis_client:
        try:
            raw = redis_client.get(telemetry_key(device_id))
            return json.loads(raw) if raw else None
        except Exception:
            pass
    return MEM_TELEMETRY.get(device_id)


def is_quiet(row: PetDeviceSetting) -> bool:
    if not row.quiet_start or not row.quiet_end:
        return False
    now = utcnow().astimezone().strftime('%H:%M')
    start, end = row.quiet_start, row.quiet_end
    if start <= end:
        return start <= now < end
    return now >= start or now < end


async def inactivity_loop() -> None:
    while True:
        try:
            with SessionLocal() as db:
                devices = db.scalars(select(Device)).all()
                now = utcnow()
                for device in devices:
                    if not device.last_seen_at or device.last_seen_at < now - timedelta(minutes=5):
                        continue
                    setting = get_setting(db, device.id)
                    cutoff = now - timedelta(minutes=setting.inactivity_minutes)
                    last_motion = db.scalar(select(Event).where(Event.device_id == device.id, Event.kind == 'motion').order_by(Event.created_at.desc()).limit(1))
                    if last_motion and last_motion.created_at > cutoff:
                        continue
                    last_idle = db.scalar(select(Event).where(Event.device_id == device.id, Event.kind == 'inactivity').order_by(Event.created_at.desc()).limit(1))
                    if last_idle and last_idle.created_at > cutoff:
                        continue
                    db.add(Event(device_id=device.id, kind='inactivity', confidence=None, metadata_json=json.dumps({'minutes': setting.inactivity_minutes}, ensure_ascii=False)))
                    db.commit()
        except Exception as exc:
            print('pet inactivity loop failed:', exc)
        await asyncio.sleep(300)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    task = asyncio.create_task(inactivity_loop())
    yield
    task.cancel()


app = FastAPI(title='CamCam Pet Service', lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
WEB = Path('/app/web')


@app.get('/health')
def health():
    return {'ok': True, 'service': 'camcam-pet'}


@app.get('/')
def pet_shell():
    return FileResponse(WEB / 'pet.html', headers={'Cache-Control': 'no-store'})


@app.get('/camera')
def pet_camera_shell():
    return FileResponse(WEB / 'pet_camera.html', headers={'Cache-Control': 'no-store'})


@app.get('/api/pet/devices')
def pet_devices(user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned = db.scalars(select(Device).where(Device.owner_id == user.id).order_by(Device.name)).all()
    shares = db.scalars(select(PetCameraShare).where(PetCameraShare.user_id == user.id)).all()
    shared_ids = [s.device_id for s in shares]
    shared_devices = db.scalars(select(Device).where(Device.id.in_(shared_ids))).all() if shared_ids else []
    roles = {s.device_id: s.role for s in shares}
    now = utcnow()
    rows = []
    seen = set()
    for d in [*owned, *shared_devices]:
        if d.id in seen:
            continue
        seen.add(d.id)
        setting = get_setting(db, d.id)
        last_event = db.scalar(select(Event).where(Event.device_id == d.id).order_by(Event.created_at.desc()).limit(1))
        rows.append({
            'id': d.id,
            'name': d.name,
            'online': bool(d.last_seen_at and d.last_seen_at > now - timedelta(seconds=45)),
            'last_seen_at': d.last_seen_at,
            'access': 'owner' if d.owner_id == user.id else roles.get(d.id, 'viewer'),
            'pet': setting_dict(setting),
            'last_event': {'kind': last_event.kind, 'created_at': last_event.created_at} if last_event else None,
            'telemetry': load_telemetry(d.id),
        })
    return rows


@app.get('/api/pet/devices/{device_id}/settings')
def read_settings(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorized_device(db, user, device_id)
    return setting_dict(get_setting(db, device_id))


@app.put('/api/pet/devices/{device_id}/settings')
def update_settings(device_id: str, body: SettingsBody, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device, role = authorized_device(db, user, device_id, caregiver=True)
    row = get_setting(db, device.id)
    for key, value in body.model_dump().items():
        setattr(row, key, value)
    row.updated_at = utcnow()
    db.commit()
    store_command(device_id, {'type': 'settings', 'value': setting_dict(row), 'at': utcnow().isoformat()})
    return setting_dict(row)


@app.get('/api/pet/device/settings')
def device_settings(x_device_id: str | None = Header(default=None), x_device_token: str | None = Header(default=None), db: Session = Depends(get_db)):
    device = verify_device(db, x_device_id, x_device_token)
    return setting_dict(get_setting(db, device.id))


@app.post('/api/pet/device/event')
def device_event(body: EventBody, x_device_id: str | None = Header(default=None), x_device_token: str | None = Header(default=None), db: Session = Depends(get_db)):
    device = verify_device(db, x_device_id, x_device_token)
    event_id = str(uuid.uuid4())
    metadata = dict(body.metadata or {})
    snapshot_url = save_snapshot(device.id, event_id, body.snapshot_data_url)
    if snapshot_url:
        metadata['snapshot_url'] = snapshot_url
    setting = get_setting(db, device.id)
    metadata['quiet'] = is_quiet(setting)
    event = Event(id=event_id, device_id=device.id, kind=body.kind, confidence=body.confidence, metadata_json=json.dumps(metadata, ensure_ascii=False))
    device.last_seen_at = utcnow()
    db.add(event)
    db.commit()
    return {'ok': True, 'event_id': event.id, 'snapshot_url': snapshot_url}


@app.get('/api/pet/devices/{device_id}/events')
def pet_events(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorized_device(db, user, device_id)
    rows = db.scalars(select(Event).where(Event.device_id == device_id).order_by(Event.created_at.desc()).limit(200)).all()
    result = []
    for e in rows:
        try:
            metadata = json.loads(e.metadata_json or '{}')
        except Exception:
            metadata = {}
        start = (e.created_at - timedelta(seconds=5)).isoformat()
        result.append({
            'id': e.id,
            'kind': e.kind,
            'confidence': e.confidence,
            'metadata': metadata,
            'created_at': e.created_at,
            'snapshot_url': metadata.get('snapshot_url'),
            'highlight_url': f'/archive/{device_id}/view?' + urlencode({'start': start, 'duration': 25}),
        })
    return result


@app.get('/api/pet/devices/{device_id}/events/{event_id}/snapshot')
def event_snapshot(device_id: str, event_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorized_device(db, user, device_id)
    event = db.get(Event, event_id)
    if not event or event.device_id != device_id:
        raise HTTPException(404, 'Event not found')
    target = event_root(device_id) / f'{event_id}.jpg'
    if not target.is_file():
        raise HTTPException(404, 'Snapshot not found')
    return FileResponse(target, media_type='image/jpeg', headers={'Cache-Control': 'private, max-age=86400'})


@app.post('/api/pet/device/telemetry')
def device_telemetry(body: TelemetryBody, x_device_id: str | None = Header(default=None), x_device_token: str | None = Header(default=None), db: Session = Depends(get_db)):
    device = verify_device(db, x_device_id, x_device_token)
    store_telemetry(device.id, body)
    device.last_seen_at = utcnow()
    db.commit()
    return {'ok': True}


@app.post('/api/pet/devices/{device_id}/command')
def send_command(device_id: str, body: CommandBody, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorized_device(db, user, device_id, caregiver=True)
    if body.type == 'quality' and str(body.value) not in {'360p', '720p', '1080p'}:
        raise HTTPException(400, 'Invalid quality')
    if body.type == 'camera' and str(body.value) not in {'front', 'back', 'switch'}:
        raise HTTPException(400, 'Invalid camera command')
    if body.type == 'zoom':
        try:
            value = float(body.value)
        except Exception as exc:
            raise HTTPException(400, 'Invalid zoom') from exc
        if not 1 <= value <= 8:
            raise HTTPException(400, 'Invalid zoom')
    if body.type == 'say' and (not isinstance(body.value, str) or len(body.value) > 80):
        raise HTTPException(400, 'Invalid phrase')
    command = {'id': secrets.token_urlsafe(8), 'type': body.type, 'value': body.value, 'at': utcnow().isoformat()}
    store_command(device_id, command)
    return {'ok': True, 'command': command}


@app.get('/api/pet/device/commands')
def device_commands(x_device_id: str | None = Header(default=None), x_device_token: str | None = Header(default=None), db: Session = Depends(get_db)):
    device = verify_device(db, x_device_id, x_device_token)
    return pop_commands(device.id)


@app.post('/api/pet/devices/{device_id}/watch-token')
def pet_watch_token(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device, _ = authorized_device(db, user, device_id)
    if not owner_is_active(db, device.owner_id):
        raise HTTPException(402, 'Subscription inactive')
    jti = secrets.token_urlsafe(18)
    token = make_token({'sub': user.id, 'device_id': device_id, 'scope': 'watch', 'purpose': 'webrtc-read', 'jti': jti}, settings.watch_token_seconds)
    if redis_client:
        try:
            redis_client.setex(f'petwatch:{jti}', settings.watch_token_seconds, f'{user.id}:{device_id}')
        except Exception:
            pass
    return {'token': token, 'whep_url': f'{settings.base_url}/webrtc/cam/{device_id}/whep', 'expires_in': settings.watch_token_seconds}


@app.post('/api/pet/devices/{device_id}/talk-token')
def talk_token(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device, _ = authorized_device(db, user, device_id, caregiver=True)
    if not owner_is_active(db, device.owner_id):
        raise HTTPException(402, 'Subscription inactive')
    jti = secrets.token_urlsafe(18)
    token = make_token({'sub': user.id, 'device_id': device_id, 'scope': 'talk', 'purpose': 'talk-publish', 'jti': jti}, 90)
    if redis_client:
        try:
            redis_client.setex(f'pettalk:{jti}', 90, f'{user.id}:{device_id}')
        except Exception:
            pass
    return {'token': token, 'whip_url': f'{settings.base_url}/webrtc/talk/{device_id}/whip', 'expires_in': 90}


@app.get('/api/pet/devices/{device_id}/health')
async def device_health(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device, _ = authorized_device(db, user, device_id)
    now = utcnow()
    online = bool(device.last_seen_at and device.last_seen_at > now - timedelta(seconds=45))
    newest_file = None
    base = recording_root(device_id)
    if base.exists():
        try:
            newest_file = max((p for p in base.rglob('*') if p.is_file()), key=lambda p: p.stat().st_mtime, default=None)
        except Exception:
            newest_file = None
    file_age = None
    if newest_file:
        file_age = max(0, int(now.timestamp() - newest_file.stat().st_mtime))
    playback_count = None
    playback_error = None
    try:
        jti = secrets.token_urlsafe(12)
        token = make_token({'sub': user.id, 'device_id': device_id, 'scope': 'watch', 'purpose': 'webrtc-read', 'jti': jti}, 30)
        async with httpx.AsyncClient(timeout=4) as client:
            response = await client.get('http://mediamtx:9996/list', params={'path': f'cam/{device_id}'}, headers={'Authorization': f'Bearer {token}'})
        if response.status_code == 200:
            payload = response.json()
            playback_count = len(payload) if isinstance(payload, list) else 0
        elif response.status_code != 404:
            playback_error = f'HTTP {response.status_code}'
    except Exception as exc:
        playback_error = str(exc)[:100]
    recording = bool((file_age is not None and file_age < 180) or (playback_count is not None and playback_count > 0))
    reason = None
    if online and not recording:
        reason = 'stream_live_but_no_recent_recording'
    elif not online:
        reason = 'camera_offline'
    return {
        'online': online,
        'recording': recording,
        'recording_file_age_seconds': file_age,
        'playback_segments': playback_count,
        'playback_error': playback_error,
        'reason': reason,
        'telemetry': load_telemetry(device_id),
    }


@app.get('/api/pet/devices/{device_id}/shares')
def list_shares(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device, role = authorized_device(db, user, device_id)
    if role != 'owner':
        raise HTTPException(403, 'Owner only')
    shares = db.scalars(select(PetCameraShare).where(PetCameraShare.device_id == device_id)).all()
    result = []
    for share in shares:
        target = db.get(User, share.user_id)
        if target:
            result.append({'id': share.id, 'email': target.email, 'role': share.role, 'created_at': share.created_at})
    return result


@app.post('/api/pet/devices/{device_id}/shares')
def create_share(device_id: str, body: ShareBody, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device, role = authorized_device(db, user, device_id)
    if role != 'owner':
        raise HTTPException(403, 'Owner only')
    target = db.scalar(select(User).where(User.email == body.email.lower().strip()))
    if not target:
        raise HTTPException(404, 'این ایمیل هنوز در CamCam حساب ندارد')
    if target.id == user.id:
        raise HTTPException(400, 'Owner already has access')
    row = db.scalar(select(PetCameraShare).where(PetCameraShare.device_id == device_id, PetCameraShare.user_id == target.id))
    if row:
        row.role = body.role
    else:
        row = PetCameraShare(device_id=device_id, user_id=target.id, role=body.role)
        db.add(row)
    db.commit()
    return {'ok': True, 'id': row.id, 'email': target.email, 'role': row.role}


@app.delete('/api/pet/devices/{device_id}/shares/{share_id}')
def delete_share(device_id: str, share_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _, role = authorized_device(db, user, device_id)
    if role != 'owner':
        raise HTTPException(403, 'Owner only')
    row = db.get(PetCameraShare, share_id)
    if not row or row.device_id != device_id:
        raise HTTPException(404, 'Share not found')
    db.delete(row)
    db.commit()
    return {'ok': True}


@app.post('/internal/mediamtx/auth')
async def mediamtx_auth(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    action = data.get('action')
    path = (data.get('path') or '').strip('/')
    parts = path.split('/')
    if len(parts) != 2 or parts[0] not in {'cam', 'talk'}:
        raise HTTPException(401, 'Denied')
    channel, device_id = parts
    device = db.get(Device, device_id)
    if not device or not owner_is_active(db, device.owner_id):
        raise HTTPException(401, 'Denied')

    supplied_user = data.get('user') or ''
    supplied_pass = data.get('password') or ''
    supplied_token = data.get('token') or ''

    if channel == 'cam' and action == 'publish':
        candidate = supplied_pass or supplied_token
        if supplied_user and supplied_user != device_id:
            raise HTTPException(401, 'Denied')
        if not candidate or not device.token_hash or not secrets.compare_digest(device.token_hash, sha(candidate)):
            raise HTTPException(401, 'Denied')
        return {'ok': True}

    if channel == 'talk' and action == 'read':
        candidate = supplied_pass or supplied_token
        if supplied_user and supplied_user != device_id:
            raise HTTPException(401, 'Denied')
        if not candidate or not device.token_hash or not secrets.compare_digest(device.token_hash, sha(candidate)):
            raise HTTPException(401, 'Denied')
        return {'ok': True}

    token = supplied_token or supplied_pass
    if not token:
        raise HTTPException(401, 'Denied')
    try:
        payload = decode_token(token)
    except HTTPException:
        raise HTTPException(401, 'Denied')
    user_id = payload.get('sub')
    if payload.get('device_id') != device_id or not user_id:
        raise HTTPException(401, 'Denied')
    if user_id != device.owner_id and not share_for(db, user_id, device_id):
        raise HTTPException(401, 'Denied')

    if channel == 'cam' and action in {'read', 'playback'}:
        if payload.get('scope') != 'watch' or payload.get('purpose') != 'webrtc-read' or not payload.get('jti'):
            raise HTTPException(401, 'Denied')
        return {'ok': True}

    if channel == 'talk' and action == 'publish':
        if payload.get('scope') != 'talk' or payload.get('purpose') != 'talk-publish' or not payload.get('jti'):
            raise HTTPException(401, 'Denied')
        share = share_for(db, user_id, device_id) if user_id != device.owner_id else None
        if share and share.role != 'caregiver':
            raise HTTPException(401, 'Denied')
        return {'ok': True}

    raise HTTPException(401, 'Denied')
