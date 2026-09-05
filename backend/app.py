from __future__ import annotations

import asyncio
import hashlib
import json
import os
import secrets
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Generator
from urllib.parse import urlparse

import httpx
import jwt
import redis
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    app_name: str = 'CamCam'
    base_url: str = 'https://camcam.smarbiz.sbs'
    secret_key: str = 'dev-only-change-me'
    database_url: str = 'sqlite:///./camcam.db'
    redis_url: str = 'redis://localhost:6379/0'
    zibal_merchant: str = ''
    starter_monthly_rial: int = 2_990_000
    starter_yearly_rial: int = 29_900_000
    pro_monthly_rial: int = 5_990_000
    pro_yearly_rial: int = 59_900_000
    admin_emails: str = ''
    secure_cookies: bool = True
    admin_session_minutes: int = 30
    watch_token_seconds: int = 60


settings = Settings()
ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)
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
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    trial_ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: utcnow() + timedelta(days=7))
    disabled: Mapped[bool] = mapped_column(Boolean, default=False)
    devices: Mapped[list['Device']] = relationship(back_populates='owner', cascade='all, delete-orphan')
    subscription: Mapped['Subscription | None'] = relationship(back_populates='user', uselist=False, cascade='all, delete-orphan')


class Device(Base):
    __tablename__ = 'devices'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(100), default='Camera')
    token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pairing_code_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    pairing_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    owner: Mapped[User] = relationship(back_populates='devices')
    events: Mapped[list['Event']] = relationship(back_populates='device', cascade='all, delete-orphan')


class Subscription(Base):
    __tablename__ = 'subscriptions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), unique=True, index=True)
    plan: Mapped[str] = mapped_column(String(30), default='starter')
    status: Mapped[str] = mapped_column(String(20), default='inactive')
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    user: Mapped[User] = relationship(back_populates='subscription')


class Payment(Base):
    __tablename__ = 'payments'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    plan_code: Mapped[str] = mapped_column(String(40))
    amount_rial: Mapped[int] = mapped_column(Integer)
    track_id: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default='pending')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Event(Base):
    __tablename__ = 'events'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(ForeignKey('devices.id', ondelete='CASCADE'), index=True)
    kind: Mapped[str] = mapped_column(String(40), default='motion')
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    device: Mapped[Device] = relationship(back_populates='events')


class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    target_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class AuthBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class DeviceBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class PairBody(BaseModel):
    code: str = Field(min_length=6, max_length=12)


class CheckoutBody(BaseModel):
    plan_code: str


class DeviceEventBody(BaseModel):
    kind: str = Field(default='motion', max_length=40)
    confidence: int | None = Field(default=None, ge=0, le=100)
    metadata: str | None = Field(default=None, max_length=2000)


class AdminUnlockBody(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class AdminUserStatusBody(BaseModel):
    disabled: bool


class AdminSubscriptionBody(BaseModel):
    plan: str = Field(pattern='^(starter|pro|inactive)$')
    days: int = Field(default=30, ge=1, le=3650)


class AdminTrialBody(BaseModel):
    days: int = Field(default=7, ge=1, le=365)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def sha(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def make_jwt(payload: dict, minutes: int | None = None, seconds: int | None = None) -> str:
    data = dict(payload)
    lifetime = timedelta(seconds=seconds) if seconds is not None else timedelta(minutes=minutes or 10)
    data['exp'] = utcnow() + lifetime
    data['iat'] = utcnow()
    return jwt.encode(data, settings.secret_key, algorithm='HS256')


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=['HS256'])
    except jwt.PyJWTError as exc:
        raise HTTPException(401, 'Invalid or expired token') from exc


def rate_limit(key: str, limit: int, window: int = 60) -> None:
    if not redis_client:
        return
    try:
        n = redis_client.incr(key)
        if n == 1:
            redis_client.expire(key, window)
        if n > limit:
            raise HTTPException(429, 'Too many requests')
    except HTTPException:
        raise
    except Exception:
        return


def client_ip(request: Request) -> str:
    cf = request.headers.get('cf-connecting-ip')
    if cf:
        return cf[:80]
    forwarded = request.headers.get('x-forwarded-for')
    if forwarded:
        return forwarded.split(',')[0].strip()[:80]
    return (request.client.host if request.client else 'unknown')[:80]


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get('camcam_session')
    if not token:
        raise HTTPException(401, 'Authentication required')
    data = decode_jwt(token)
    if data.get('scope') != 'session':
        raise HTTPException(401, 'Invalid session')
    user = db.get(User, data.get('sub'))
    if not user or user.disabled:
        raise HTTPException(401, 'Authentication required')
    return user


def admin_email_set() -> set[str]:
    return {e.strip().lower() for e in settings.admin_emails.split(',') if e.strip()}


def is_admin_email(user: User) -> bool:
    return user.email.lower() in admin_email_set()


def entitlement(user: User) -> dict:
    now = utcnow()
    sub = user.subscription
    if sub and sub.status == 'active' and sub.current_period_end and sub.current_period_end > now:
        if sub.plan == 'pro':
            return {'active': True, 'plan': 'pro', 'camera_limit': 10, 'retention_days': 30, 'until': sub.current_period_end}
        return {'active': True, 'plan': 'starter', 'camera_limit': 3, 'retention_days': 7, 'until': sub.current_period_end}
    if user.trial_ends_at and user.trial_ends_at > now:
        return {'active': True, 'plan': 'trial', 'camera_limit': 1, 'retention_days': 1, 'until': user.trial_ends_at}
    return {'active': False, 'plan': 'expired', 'camera_limit': 0, 'retention_days': 0, 'until': None}


def owned_device(db: Session, user: User, device_id: str) -> Device:
    device = db.scalar(select(Device).where(Device.id == device_id, Device.owner_id == user.id))
    if not device:
        raise HTTPException(404, 'Camera not found')
    return device


def verify_device_headers(db: Session, device_id: str | None, device_token: str | None) -> Device:
    if not device_id or not device_token:
        raise HTTPException(401, 'Device credentials required')
    device = db.get(Device, device_id)
    if not device or not device.token_hash or not secrets.compare_digest(device.token_hash, sha(device_token)):
        raise HTTPException(401, 'Invalid device credentials')
    owner = db.get(User, device.owner_id)
    if not owner or not entitlement(owner)['active']:
        raise HTTPException(402, 'Subscription inactive')
    return device


def record_root(device_id: str | None = None) -> Path:
    root = Path('/recordings/cam')
    return root / device_id if device_id else root


def path_size(path: Path) -> int:
    if not path.exists():
        return 0
    total = 0
    try:
        for file in path.rglob('*'):
            try:
                if file.is_file():
                    total += file.stat().st_size
            except OSError:
                continue
    except OSError:
        return total
    return total


def audit(db: Session, actor: User | None, action: str, request: Request | None = None,
          target_type: str | None = None, target_id: str | None = None, metadata: dict | None = None) -> None:
    row = AuditLog(
        actor_user_id=actor.id if actor else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata_json=json.dumps(metadata or {}, ensure_ascii=False),
        ip=client_ip(request) if request else None,
    )
    db.add(row)


def admin_guard(request: Request, user: User = Depends(current_user)) -> User:
    if not is_admin_email(user):
        raise HTTPException(403, 'Admin only')
    token = request.cookies.get('camcam_admin')
    if not token:
        raise HTTPException(428, 'Admin unlock required')
    data = decode_jwt(token)
    if data.get('scope') != 'admin' or data.get('sub') != user.id:
        raise HTTPException(428, 'Admin unlock required')
    return user


PLAN_MAP = {
    'starter_monthly': ('starter', 30, lambda: settings.starter_monthly_rial),
    'starter_yearly': ('starter', 365, lambda: settings.starter_yearly_rial),
    'pro_monthly': ('pro', 30, lambda: settings.pro_monthly_rial),
    'pro_yearly': ('pro', 365, lambda: settings.pro_yearly_rial),
}


def public_plans() -> list[dict]:
    return [
        {'code': 'starter_monthly', 'name': 'Starter', 'cycle': 'monthly', 'amount_rial': settings.starter_monthly_rial, 'cameras': 3, 'retention_days': 7},
        {'code': 'starter_yearly', 'name': 'Starter', 'cycle': 'yearly', 'amount_rial': settings.starter_yearly_rial, 'cameras': 3, 'retention_days': 7},
        {'code': 'pro_monthly', 'name': 'Pro', 'cycle': 'monthly', 'amount_rial': settings.pro_monthly_rial, 'cameras': 10, 'retention_days': 30},
        {'code': 'pro_yearly', 'name': 'Pro', 'cycle': 'yearly', 'amount_rial': settings.pro_yearly_rial, 'cameras': 10, 'retention_days': 30},
    ]


async def cleanup_recordings() -> None:
    root = record_root()
    while True:
        try:
            with SessionLocal() as db:
                devices = db.scalars(select(Device)).all()
                now = utcnow().timestamp()
                for device in devices:
                    owner = db.get(User, device.owner_id)
                    days = max(1, entitlement(owner)['retention_days']) if owner else 1
                    cutoff = now - days * 86400
                    folder = root / device.id
                    if folder.exists():
                        for file in folder.rglob('*'):
                            if file.is_file() and file.stat().st_mtime < cutoff:
                                file.unlink(missing_ok=True)
        except Exception as exc:
            print('retention cleanup failed:', exc)
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    task = asyncio.create_task(cleanup_recordings())
    yield
    task.cancel()


app = FastAPI(title='CamCam API', lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
parsed_host = urlparse(settings.base_url).hostname or 'camcam.smarbiz.sbs'
app.add_middleware(TrustedHostMiddleware, allowed_hosts=[parsed_host, 'localhost', '127.0.0.1', 'api'])


@app.middleware('http')
async def security_middleware(request: Request, call_next):
    if request.method in {'POST', 'PUT', 'PATCH', 'DELETE'} and not request.url.path.startswith('/internal/'):
        origin = request.headers.get('origin')
        if origin and origin.rstrip('/') != settings.base_url.rstrip('/'):
            return Response('Forbidden origin', status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'same-origin'
    response.headers['Permissions-Policy'] = 'camera=(self), microphone=(self), geolocation=()'
    response.headers['Cross-Origin-Resource-Policy'] = 'same-origin'
    if request.url.path.startswith('/api/') or request.url.path == '/admin':
        response.headers['Cache-Control'] = 'no-store, max-age=0'
    return response


WEB = Path('/app/web')
app.mount('/static', StaticFiles(directory=WEB), name='static')


@app.get('/')
def index():
    return FileResponse(WEB / 'index.html')


@app.get('/camera')
def camera_page():
    return FileResponse(WEB / 'camera.html')


@app.get('/admin')
def admin_page():
    return FileResponse(WEB / 'admin.html')


@app.get('/health')
def health(db: Session = Depends(get_db)):
    db.scalar(select(func.count(User.id)))
    return {'ok': True, 'service': 'camcam'}


@app.post('/api/auth/register')
def register(body: AuthBody, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit(f"register:{client_ip(request)}", 8, 600)
    email = body.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, 'Email already registered')
    user = User(email=email, password_hash=ph.hash(body.password))
    db.add(user)
    db.flush()
    audit(db, user, 'auth.register', request, 'user', user.id)
    db.commit()
    token = make_jwt({'sub': user.id, 'scope': 'session'}, minutes=60 * 24 * 14)
    response.set_cookie('camcam_session', token, httponly=True, secure=settings.secure_cookies, samesite='strict', max_age=60 * 60 * 24 * 14, path='/')
    return {'ok': True, 'trial_days': 7}


@app.post('/api/auth/login')
def login(body: AuthBody, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit(f"login:{client_ip(request)}", 12, 300)
    user = db.scalar(select(User).where(User.email == body.email.lower().strip()))
    if not user:
        ph.hash(body.password)
        raise HTTPException(401, 'Invalid email or password')
    try:
        ph.verify(user.password_hash, body.password)
    except VerifyMismatchError:
        raise HTTPException(401, 'Invalid email or password')
    if user.disabled:
        raise HTTPException(403, 'Account disabled')
    token = make_jwt({'sub': user.id, 'scope': 'session'}, minutes=60 * 24 * 14)
    response.set_cookie('camcam_session', token, httponly=True, secure=settings.secure_cookies, samesite='strict', max_age=60 * 60 * 24 * 14, path='/')
    audit(db, user, 'auth.login', request, 'user', user.id)
    db.commit()
    return {'ok': True}


@app.post('/api/auth/logout')
def logout(response: Response):
    response.delete_cookie('camcam_session', path='/')
    response.delete_cookie('camcam_admin', path='/')
    return {'ok': True}


@app.get('/api/me')
def me(user: User = Depends(current_user)):
    return {
        'id': user.id,
        'email': user.email,
        'created_at': user.created_at,
        'entitlement': entitlement(user),
        'is_admin': is_admin_email(user),
    }


@app.get('/api/plans')
def plans():
    return public_plans()


def new_pair_code(device: Device) -> str:
    code = f'{secrets.randbelow(100_000_000):08d}'
    device.pairing_code_hash = sha(code)
    device.pairing_expires_at = utcnow() + timedelta(minutes=10)
    return code


@app.get('/api/devices')
def list_devices(user: User = Depends(current_user), db: Session = Depends(get_db)):
    devices = db.scalars(select(Device).where(Device.owner_id == user.id).order_by(Device.created_at.desc())).all()
    now = utcnow()
    return [
        {
            'id': d.id,
            'name': d.name,
            'online': bool(d.last_seen_at and d.last_seen_at > now - timedelta(seconds=45)),
            'last_seen_at': d.last_seen_at,
            'created_at': d.created_at,
        }
        for d in devices
    ]


@app.post('/api/devices')
def create_device(body: DeviceBody, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ent = entitlement(user)
    if not ent['active']:
        raise HTTPException(402, 'Subscription required')
    count = db.scalar(select(func.count(Device.id)).where(Device.owner_id == user.id)) or 0
    if count >= ent['camera_limit']:
        raise HTTPException(402, 'Camera limit reached for current plan')
    device = Device(owner_id=user.id, name=body.name.strip())
    code = new_pair_code(device)
    db.add(device)
    db.commit()
    return {'id': device.id, 'name': device.name, 'pairing_code': code, 'pairing_expires_in_seconds': 600}


@app.post('/api/devices/{device_id}/pair-code')
def regenerate_pair_code(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device = owned_device(db, user, device_id)
    code = new_pair_code(device)
    db.commit()
    return {'pairing_code': code, 'pairing_expires_in_seconds': 600}


@app.delete('/api/devices/{device_id}')
def delete_device(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device = owned_device(db, user, device_id)
    db.delete(device)
    db.commit()
    return {'ok': True}


@app.post('/api/pair')
def pair(body: PairBody, request: Request, db: Session = Depends(get_db)):
    rate_limit(f"pair:{client_ip(request)}", 20, 300)
    code_hash = sha(body.code.strip())
    device = db.scalar(select(Device).where(Device.pairing_code_hash == code_hash))
    if not device or not device.pairing_expires_at or device.pairing_expires_at < utcnow():
        raise HTTPException(400, 'Invalid or expired pairing code')
    owner = db.get(User, device.owner_id)
    if not owner or not entitlement(owner)['active']:
        raise HTTPException(402, 'Owner subscription is inactive')
    raw_token = secrets.token_urlsafe(48)
    device.token_hash = sha(raw_token)
    device.pairing_code_hash = None
    device.pairing_expires_at = None
    device.last_seen_at = utcnow()
    db.commit()
    return {
        'device_id': device.id,
        'name': device.name,
        'device_token': raw_token,
        'whip_url': f"{settings.base_url}/webrtc/cam/{device.id}/whip",
    }


@app.post('/api/device/heartbeat')
def heartbeat(x_device_id: str | None = Header(default=None), x_device_token: str | None = Header(default=None), db: Session = Depends(get_db)):
    device = verify_device_headers(db, x_device_id, x_device_token)
    device.last_seen_at = utcnow()
    db.commit()
    return {'ok': True}


@app.post('/api/device/event')
def device_event(body: DeviceEventBody, x_device_id: str | None = Header(default=None), x_device_token: str | None = Header(default=None), db: Session = Depends(get_db)):
    device = verify_device_headers(db, x_device_id, x_device_token)
    event = Event(device_id=device.id, kind=body.kind, confidence=body.confidence, metadata_json=body.metadata)
    device.last_seen_at = utcnow()
    db.add(event)
    db.commit()
    return {'ok': True, 'event_id': event.id}


@app.get('/api/devices/{device_id}/events')
def events(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned_device(db, user, device_id)
    rows = db.scalars(select(Event).where(Event.device_id == device_id).order_by(Event.created_at.desc()).limit(200)).all()
    return [
        {'id': e.id, 'kind': e.kind, 'confidence': e.confidence, 'metadata': e.metadata_json, 'created_at': e.created_at}
        for e in rows
    ]


@app.post('/api/devices/{device_id}/watch-token')
def watch_token(device_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned_device(db, user, device_id)
    if not entitlement(user)['active']:
        raise HTTPException(402, 'Subscription inactive')
    rate_limit(f'watch:{user.id}', 90, 60)
    jti = secrets.token_urlsafe(18)
    token = make_jwt(
        {'sub': user.id, 'device_id': device_id, 'scope': 'watch', 'purpose': 'webrtc-read', 'jti': jti},
        seconds=settings.watch_token_seconds,
    )
    if redis_client:
        try:
            redis_client.setex(f'watch:{jti}', settings.watch_token_seconds, f'{user.id}:{device_id}')
        except Exception:
            pass
    return {
        'token': token,
        'whep_url': f"{settings.base_url}/webrtc/cam/{device_id}/whep",
        'expires_in': settings.watch_token_seconds,
    }


@app.post('/internal/mediamtx/auth')
async def mediamtx_auth(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    action = data.get('action')
    path = (data.get('path') or '').strip('/')
    parts = path.split('/')
    if len(parts) != 2 or parts[0] != 'cam':
        raise HTTPException(401, 'Denied')
    device_id = parts[1]
    device = db.get(Device, device_id)
    if not device:
        raise HTTPException(401, 'Denied')
    if action == 'publish':
        supplied_user = data.get('user') or ''
        supplied_pass = data.get('password') or ''
        supplied_token = data.get('token') or ''
        candidate = supplied_pass or supplied_token
        if supplied_user and supplied_user != device_id:
            raise HTTPException(401, 'Denied')
        if not candidate or not device.token_hash or not secrets.compare_digest(device.token_hash, sha(candidate)):
            raise HTTPException(401, 'Denied')
        owner = db.get(User, device.owner_id)
        if not owner or not entitlement(owner)['active']:
            raise HTTPException(401, 'Denied')
        return {'ok': True}
    if action in {'read', 'playback'}:
        token = data.get('token') or data.get('password') or ''
        try:
            payload = decode_jwt(token)
        except HTTPException:
            raise HTTPException(401, 'Denied')
        if (
            payload.get('scope') != 'watch'
            or payload.get('purpose') != 'webrtc-read'
            or payload.get('device_id') != device_id
            or payload.get('sub') != device.owner_id
            or not payload.get('jti')
        ):
            raise HTTPException(401, 'Denied')
        if redis_client:
            try:
                expected = redis_client.get(f"watch:{payload['jti']}")
                if expected is not None and expected != f"{device.owner_id}:{device_id}":
                    raise HTTPException(401, 'Denied')
            except HTTPException:
                raise
            except Exception:
                pass
        return {'ok': True}
    raise HTTPException(401, 'Denied')


@app.get('/api/devices/{device_id}/recordings')
def recordings(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned_device(db, user, device_id)
    base = record_root(device_id)
    if not base.exists():
        return []
    rows = []
    for file in sorted((p for p in base.rglob('*') if p.is_file()), key=lambda p: p.stat().st_mtime, reverse=True)[:300]:
        rel = file.relative_to(base).as_posix()
        rows.append({
            'path': rel,
            'size': file.stat().st_size,
            'created_at': datetime.fromtimestamp(file.stat().st_mtime, tz=timezone.utc),
            'url': f'/api/devices/{device_id}/recordings/{rel}',
        })
    return rows


@app.get('/api/devices/{device_id}/recordings/{recording_path:path}')
def recording_file(device_id: str, recording_path: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned_device(db, user, device_id)
    base = record_root(device_id).resolve()
    target = (base / recording_path).resolve()
    if base not in target.parents or not target.is_file():
        raise HTTPException(404, 'Recording not found')
    return FileResponse(target, media_type='video/mp4', filename=target.name, headers={'Cache-Control': 'private, no-store'})


@app.post('/api/billing/checkout')
async def checkout(body: CheckoutBody, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.plan_code not in PLAN_MAP:
        raise HTTPException(400, 'Unknown plan')
    if not settings.zibal_merchant:
        raise HTTPException(503, 'Payment gateway is not configured')
    plan, _, price_fn = PLAN_MAP[body.plan_code]
    amount = int(price_fn())
    payment = Payment(user_id=user.id, plan_code=body.plan_code, amount_rial=amount)
    db.add(payment)
    db.commit()
    callback = f'{settings.base_url}/api/billing/zibal/callback'
    payload = {
        'merchant': settings.zibal_merchant,
        'amount': amount,
        'callbackUrl': callback,
        'description': f'CamCam {plan} subscription',
        'orderId': payment.id,
    }
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            res = await client.post('https://gateway.zibal.ir/v1/request', json=payload)
            res.raise_for_status()
            data = res.json()
    except Exception as exc:
        payment.status = 'gateway_error'
        db.commit()
        raise HTTPException(502, 'Could not connect to payment gateway') from exc
    if data.get('result') != 100 or not data.get('trackId'):
        payment.status = 'gateway_error'
        db.commit()
        raise HTTPException(502, data.get('message') or 'Payment request rejected')
    payment.track_id = str(data['trackId'])
    db.commit()
    return {'redirect_url': f"https://gateway.zibal.ir/start/{payment.track_id}", 'payment_id': payment.id}


@app.get('/api/billing/zibal/callback')
async def zibal_callback(request: Request, db: Session = Depends(get_db)):
    track_id = request.query_params.get('trackId') or request.query_params.get('trackid')
    if not track_id:
        return RedirectResponse(f'{settings.base_url}/?payment=failed', status_code=303)
    payment = db.scalar(select(Payment).where(Payment.track_id == str(track_id)))
    if not payment:
        return RedirectResponse(f'{settings.base_url}/?payment=failed', status_code=303)
    if payment.activated_at:
        return RedirectResponse(f'{settings.base_url}/?payment=success', status_code=303)
    if not settings.zibal_merchant:
        return RedirectResponse(f'{settings.base_url}/?payment=failed', status_code=303)
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            res = await client.post('https://gateway.zibal.ir/v1/verify', json={'merchant': settings.zibal_merchant, 'trackId': int(track_id)})
            res.raise_for_status()
            data = res.json()
    except Exception:
        return RedirectResponse(f'{settings.base_url}/?payment=pending', status_code=303)
    if data.get('result') not in {100, 201}:
        payment.status = 'failed'
        db.commit()
        return RedirectResponse(f'{settings.base_url}/?payment=failed', status_code=303)
    verified_amount = int(data.get('amount') or 0)
    if verified_amount and verified_amount != payment.amount_rial:
        payment.status = 'amount_mismatch'
        db.commit()
        return RedirectResponse(f'{settings.base_url}/?payment=failed', status_code=303)
    plan, days, _ = PLAN_MAP[payment.plan_code]
    user = db.get(User, payment.user_id)
    if not user:
        return RedirectResponse(f'{settings.base_url}/?payment=failed', status_code=303)
    sub = user.subscription
    if not sub:
        sub = Subscription(user_id=user.id)
        db.add(sub)
        db.flush()
    base = sub.current_period_end if sub.current_period_end and sub.current_period_end > utcnow() else utcnow()
    sub.plan = plan
    sub.status = 'active'
    sub.current_period_end = base + timedelta(days=days)
    payment.status = 'verified'
    payment.verified_at = utcnow()
    payment.activated_at = utcnow()
    db.commit()
    return RedirectResponse(f'{settings.base_url}/?payment=success', status_code=303)


@app.get('/api/billing/payments')
def payment_history(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Payment).where(Payment.user_id == user.id).order_by(Payment.created_at.desc()).limit(100)).all()
    return [
        {'id': p.id, 'plan_code': p.plan_code, 'amount_rial': p.amount_rial, 'status': p.status, 'created_at': p.created_at, 'verified_at': p.verified_at}
        for p in rows
    ]


@app.get('/api/admin/presence')
def admin_presence(request: Request, user: User = Depends(current_user)):
    eligible = is_admin_email(user)
    unlocked = False
    if eligible and request.cookies.get('camcam_admin'):
        try:
            data = decode_jwt(request.cookies['camcam_admin'])
            unlocked = data.get('scope') == 'admin' and data.get('sub') == user.id
        except HTTPException:
            unlocked = False
    return {'eligible': eligible, 'unlocked': unlocked, 'email': user.email, 'session_minutes': settings.admin_session_minutes}


@app.post('/api/admin/unlock')
def admin_unlock(body: AdminUnlockBody, request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not is_admin_email(user):
        raise HTTPException(403, 'Admin only')
    rate_limit(f'admin-unlock:{user.id}:{client_ip(request)}', 6, 600)
    try:
        ph.verify(user.password_hash, body.password)
    except VerifyMismatchError:
        audit(db, user, 'admin.unlock_failed', request, 'user', user.id)
        db.commit()
        raise HTTPException(401, 'Wrong password')
    token = make_jwt({'sub': user.id, 'scope': 'admin', 'nonce': secrets.token_urlsafe(12)}, minutes=settings.admin_session_minutes)
    response.set_cookie(
        'camcam_admin', token, httponly=True, secure=settings.secure_cookies, samesite='strict',
        max_age=settings.admin_session_minutes * 60, path='/'
    )
    audit(db, user, 'admin.unlock', request, 'user', user.id)
    db.commit()
    return {'ok': True, 'expires_in': settings.admin_session_minutes * 60}


@app.post('/api/admin/lock')
def admin_lock(response: Response, admin: User = Depends(admin_guard)):
    response.delete_cookie('camcam_admin', path='/')
    return {'ok': True, 'user_id': admin.id}


@app.get('/api/admin/overview')
def admin_overview(_: User = Depends(admin_guard), db: Session = Depends(get_db)):
    now = utcnow()
    users = db.scalars(select(User)).all()
    devices = db.scalars(select(Device)).all()
    online_cutoff = now - timedelta(seconds=45)
    active_subs = db.scalars(select(Subscription).where(Subscription.status == 'active')).all()
    verified_revenue = db.scalar(select(func.coalesce(func.sum(Payment.amount_rial), 0)).where(Payment.status == 'verified')) or 0
    revenue_30d = db.scalar(
        select(func.coalesce(func.sum(Payment.amount_rial), 0)).where(Payment.status == 'verified', Payment.created_at >= now - timedelta(days=30))
    ) or 0
    events_24h = db.scalar(select(func.count(Event.id)).where(Event.created_at >= now - timedelta(hours=24))) or 0
    registrations_7d = db.scalar(select(func.count(User.id)).where(User.created_at >= now - timedelta(days=7))) or 0
    return {
        'users_total': len(users),
        'users_disabled': sum(1 for u in users if u.disabled),
        'users_trial': sum(1 for u in users if entitlement(u)['plan'] == 'trial'),
        'subscriptions_active': sum(1 for s in active_subs if s.current_period_end and s.current_period_end > now),
        'devices_total': len(devices),
        'devices_online': sum(1 for d in devices if d.last_seen_at and d.last_seen_at > online_cutoff),
        'devices_unpaired': sum(1 for d in devices if not d.token_hash),
        'events_24h': events_24h,
        'registrations_7d': registrations_7d,
        'revenue_rial': int(verified_revenue),
        'revenue_30d_rial': int(revenue_30d),
        'recordings_bytes': path_size(record_root()),
        'generated_at': now,
    }


@app.get('/api/admin/users')
def admin_users(request: Request, _: User = Depends(admin_guard), db: Session = Depends(get_db)):
    q = (request.query_params.get('q') or '').strip().lower()
    page = max(1, int(request.query_params.get('page') or 1))
    limit = min(100, max(10, int(request.query_params.get('limit') or 40)))
    stmt = select(User)
    count_stmt = select(func.count(User.id))
    if q:
        stmt = stmt.where(func.lower(User.email).contains(q))
        count_stmt = count_stmt.where(func.lower(User.email).contains(q))
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(stmt.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit)).all()
    now = utcnow()
    data = []
    for user in rows:
        cams = db.scalars(select(Device).where(Device.owner_id == user.id)).all()
        ent = entitlement(user)
        data.append({
            'id': user.id,
            'email': user.email,
            'created_at': user.created_at,
            'disabled': user.disabled,
            'plan': ent['plan'],
            'active': ent['active'],
            'until': ent['until'],
            'camera_count': len(cams),
            'online_count': sum(1 for d in cams if d.last_seen_at and d.last_seen_at > now - timedelta(seconds=45)),
        })
    return {'items': data, 'total': total, 'page': page, 'limit': limit}


@app.get('/api/admin/users/{user_id}')
def admin_user_detail(user_id: str, _: User = Depends(admin_guard), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, 'User not found')
    now = utcnow()
    cams = db.scalars(select(Device).where(Device.owner_id == user.id).order_by(Device.created_at.desc())).all()
    payments = db.scalars(select(Payment).where(Payment.user_id == user.id).order_by(Payment.created_at.desc()).limit(30)).all()
    sub = user.subscription
    devices = []
    for d in cams:
        devices.append({
            'id': d.id,
            'name': d.name,
            'online': bool(d.last_seen_at and d.last_seen_at > now - timedelta(seconds=45)),
            'last_seen_at': d.last_seen_at,
            'created_at': d.created_at,
            'paired': bool(d.token_hash),
            'events': db.scalar(select(func.count(Event.id)).where(Event.device_id == d.id)) or 0,
            'storage_bytes': path_size(record_root(d.id)),
        })
    return {
        'id': user.id,
        'email': user.email,
        'created_at': user.created_at,
        'disabled': user.disabled,
        'trial_ends_at': user.trial_ends_at,
        'entitlement': entitlement(user),
        'subscription': None if not sub else {
            'plan': sub.plan,
            'status': sub.status,
            'current_period_end': sub.current_period_end,
            'updated_at': sub.updated_at,
        },
        'devices': devices,
        'payments': [
            {'id': p.id, 'plan_code': p.plan_code, 'amount_rial': p.amount_rial, 'status': p.status, 'created_at': p.created_at}
            for p in payments
        ],
    }


@app.post('/api/admin/users/{user_id}/status')
def admin_set_user_status(user_id: str, body: AdminUserStatusBody, request: Request, admin: User = Depends(admin_guard), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, 'User not found')
    if user.id == admin.id and body.disabled:
        raise HTTPException(400, 'You cannot disable your own admin account')
    user.disabled = body.disabled
    audit(db, admin, 'admin.user_status', request, 'user', user.id, {'disabled': body.disabled})
    db.commit()
    return {'ok': True, 'disabled': user.disabled}


@app.post('/api/admin/users/{user_id}/subscription')
def admin_set_subscription(user_id: str, body: AdminSubscriptionBody, request: Request, admin: User = Depends(admin_guard), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, 'User not found')
    sub = user.subscription
    if not sub:
        sub = Subscription(user_id=user.id)
        db.add(sub)
        db.flush()
    if body.plan == 'inactive':
        sub.status = 'inactive'
        sub.current_period_end = utcnow()
    else:
        sub.plan = body.plan
        sub.status = 'active'
        sub.current_period_end = utcnow() + timedelta(days=body.days)
    audit(db, admin, 'admin.subscription_set', request, 'user', user.id, {'plan': body.plan, 'days': body.days})
    db.commit()
    return {'ok': True, 'entitlement': entitlement(user)}


@app.post('/api/admin/users/{user_id}/trial')
def admin_extend_trial(user_id: str, body: AdminTrialBody, request: Request, admin: User = Depends(admin_guard), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, 'User not found')
    base = user.trial_ends_at if user.trial_ends_at and user.trial_ends_at > utcnow() else utcnow()
    user.trial_ends_at = base + timedelta(days=body.days)
    audit(db, admin, 'admin.trial_extend', request, 'user', user.id, {'days': body.days})
    db.commit()
    return {'ok': True, 'trial_ends_at': user.trial_ends_at}


@app.post('/api/admin/devices/{device_id}/revoke')
def admin_revoke_device(device_id: str, request: Request, admin: User = Depends(admin_guard), db: Session = Depends(get_db)):
    device = db.get(Device, device_id)
    if not device:
        raise HTTPException(404, 'Camera not found')
    device.token_hash = None
    device.last_seen_at = None
    device.pairing_code_hash = None
    device.pairing_expires_at = None
    audit(db, admin, 'admin.device_revoke', request, 'device', device.id, {'owner_id': device.owner_id, 'name': device.name})
    db.commit()
    return {'ok': True}


@app.get('/api/admin/payments')
def admin_payments(request: Request, _: User = Depends(admin_guard), db: Session = Depends(get_db)):
    status = (request.query_params.get('status') or '').strip()
    stmt = select(Payment)
    if status:
        stmt = stmt.where(Payment.status == status)
    rows = db.scalars(stmt.order_by(Payment.created_at.desc()).limit(250)).all()
    out = []
    for p in rows:
        user = db.get(User, p.user_id)
        out.append({
            'id': p.id,
            'user_id': p.user_id,
            'email': user.email if user else '—',
            'plan_code': p.plan_code,
            'amount_rial': p.amount_rial,
            'status': p.status,
            'track_id': p.track_id,
            'created_at': p.created_at,
            'verified_at': p.verified_at,
        })
    return out


@app.get('/api/admin/audit')
def admin_audit(_: User = Depends(admin_guard), db: Session = Depends(get_db)):
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(250)).all()
    actors = {u.id: u.email for u in db.scalars(select(User)).all()}
    return [
        {
            'id': r.id,
            'actor': actors.get(r.actor_user_id, r.actor_user_id or 'system'),
            'action': r.action,
            'target_type': r.target_type,
            'target_id': r.target_id,
            'metadata': json.loads(r.metadata_json or '{}'),
            'ip': r.ip,
            'created_at': r.created_at,
        }
        for r in rows
    ]


@app.get('/api/admin/system')
def admin_system(_: User = Depends(admin_guard), db: Session = Depends(get_db)):
    db_ok = True
    try:
        db.scalar(select(func.count(User.id)))
    except Exception:
        db_ok = False
    redis_ok = False
    if redis_client:
        try:
            redis_ok = bool(redis_client.ping())
        except Exception:
            redis_ok = False
    root = record_root()
    stat = os.statvfs(root if root.exists() else '/')
    disk_total = stat.f_frsize * stat.f_blocks
    disk_free = stat.f_frsize * stat.f_bavail
    return {
        'database': db_ok,
        'redis': redis_ok,
        'recordings_bytes': path_size(root),
        'disk_total_bytes': disk_total,
        'disk_free_bytes': disk_free,
        'security': {
            'https_only': settings.base_url.startswith('https://'),
            'secure_cookies': settings.secure_cookies,
            'admin_step_up': True,
            'watch_token_seconds': settings.watch_token_seconds,
            'device_tokens_hashed': True,
            'pair_codes_hashed': True,
            'owner_scoped_recordings': True,
            'admin_can_watch_user_streams': False,
            'webrtc_media_encryption': 'DTLS-SRTP',
            'signaling_transport': 'HTTPS/TLS through Caddy',
        },
    }
