from __future__ import annotations

import base64
import json
import re
import uuid
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

import pet_app as base

app = base.app

CATEGORIES = {'portrait', 'play', 'walk', 'food', 'sleep', 'health', 'grooming', 'training', 'family', 'other'}
IMAGE_TYPES = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'}
VIDEO_TYPES = {'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov'}


class PetMedia(base.Base):
    __tablename__ = 'pet_gallery_media'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    media_type: Mapped[str] = mapped_column(String(10), index=True)
    category: Mapped[str] = mapped_column(String(24), default='other', index=True)
    original_name: Mapped[str] = mapped_column(String(240), default='')
    stored_name: Mapped[str] = mapped_column(String(80), unique=True)
    mime_type: Mapped[str] = mapped_column(String(80))
    size_bytes: Mapped[int] = mapped_column(Integer)
    caption: Mapped[str] = mapped_column(Text, default='')
    ai_caption: Mapped[str] = mapped_column(Text, default='')
    classified_by: Mapped[str] = mapped_column(String(20), default='fallback')
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=base.utcnow, index=True)


class MediaUpdate(BaseModel):
    category: str = Field(pattern='^(portrait|play|walk|food|sleep|health|grooming|training|family|other)$')
    caption: str = Field(default='', max_length=1000)


def media_dict(row: PetMedia) -> dict:
    return {
        'id': row.id, 'media_type': row.media_type, 'category': row.category,
        'original_name': row.original_name, 'mime_type': row.mime_type,
        'size_bytes': row.size_bytes, 'caption': row.caption or '',
        'ai_caption': row.ai_caption or '', 'classified_by': row.classified_by,
        'captured_at': row.captured_at, 'created_at': row.created_at,
        'url': f'/api/pet/devices/{row.device_id}/gallery/{row.id}/file',
    }


def fallback_category(filename: str) -> str:
    name = filename.lower()
    hints = {
        'food': ('food', 'meal', 'feed', 'غذا'), 'sleep': ('sleep', 'nap', 'خواب'),
        'walk': ('walk', 'park', 'outside', 'پیاده'), 'play': ('play', 'ball', 'toy', 'بازی'),
        'health': ('vet', 'clinic', 'medicine', 'health', 'دکتر', 'دارو'),
        'grooming': ('bath', 'groom', 'wash', 'حمام'), 'training': ('train', 'تمرین'),
        'family': ('family', 'together', 'خانواده'), 'portrait': ('portrait', 'selfie', 'پرتره'),
    }
    return next((category for category, words in hints.items() if any(word in name for word in words)), 'other')


async def classify_image(data: bytes, mime_type: str, filename: str) -> tuple[str, str, str]:
    fallback = fallback_category(filename)
    if not base.settings.cloudflare_account_id or not base.settings.cloudflare_ai_token:
        return fallback, '', 'fallback'
    model = base.settings.cloudflare_vision_model.lstrip('/')
    url = f'https://api.cloudflare.com/client/v4/accounts/{base.settings.cloudflare_account_id}/ai/run/{model}'
    prompt = (
        'این تصویر گالری حیوان خانگی را فقط در یکی از دسته‌های زیر قرار بده: '
        'portrait, play, walk, food, sleep, health, grooming, training, family, other. '
        'فقط JSON کوتاه مثل {"category":"play","caption":"توضیح فارسی کوتاه"} برگردان.'
    )
    payload = {'messages': [{'role': 'system', 'content': 'You classify pet memories.'},
                            {'role': 'user', 'content': prompt}],
               'image': f'data:{mime_type};base64,{base64.b64encode(data).decode()}', 'max_tokens': 100}
    try:
        async with httpx.AsyncClient(timeout=35) as client:
            response = await client.post(url, headers={'Authorization': f'Bearer {base.settings.cloudflare_ai_token}'}, json=payload)
            response.raise_for_status()
            result = response.json().get('result') or {}
        raw = result.get('response', '') if isinstance(result, dict) else str(result)
        match = re.search(r'\{.*?\}', raw, re.S)
        parsed = json.loads(match.group(0)) if match else {}
        category = parsed.get('category', fallback)
        if category not in CATEGORIES:
            category = fallback
        return category, str(parsed.get('caption', ''))[:500], 'cloudflare'
    except Exception:
        return fallback, '', 'fallback'


def get_media(db: Session, device_id: str, media_id: str) -> PetMedia:
    row = db.scalar(select(PetMedia).where(PetMedia.id == media_id, PetMedia.device_id == device_id))
    if not row:
        raise HTTPException(404, 'فایل گالری پیدا نشد')
    return row


@app.get('/api/pet/devices/{device_id}/gallery')
def list_gallery(device_id: str, category: str | None = None, user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    base.authorized_device(db, user, device_id)
    query = select(PetMedia).where(PetMedia.device_id == device_id)
    if category and category != 'all':
        if category not in CATEGORIES:
            raise HTTPException(422, 'دسته نامعتبر است')
        query = query.where(PetMedia.category == category)
    rows = db.scalars(query.order_by(PetMedia.captured_at.desc(), PetMedia.created_at.desc()).limit(300)).all()
    return [media_dict(row) for row in rows]


@app.post('/api/pet/devices/{device_id}/gallery')
async def upload_gallery(
    device_id: str, file: UploadFile = File(...), caption: str = Form(default='', max_length=1000),
    captured_at: datetime | None = Form(default=None), user: base.User = Depends(base.current_user),
    db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id, caregiver=True)
    mime = (file.content_type or '').lower()
    if mime in IMAGE_TYPES:
        media_type, suffix, limit = 'image', IMAGE_TYPES[mime], base.settings.gallery_image_max_bytes
    elif mime in VIDEO_TYPES:
        media_type, suffix, limit = 'video', VIDEO_TYPES[mime], base.settings.gallery_video_max_bytes
    else:
        raise HTTPException(415, 'فرمت مجاز نیست؛ JPG، PNG، WebP، MP4، MOV یا WebM انتخاب کن')
    data = await file.read(limit + 1)
    if not data:
        raise HTTPException(422, 'فایل خالی است')
    if len(data) > limit:
        raise HTTPException(413, 'حجم فایل بیشتر از حد مجاز است')
    category, ai_caption, source = await classify_image(data, mime, file.filename or '') if media_type == 'image' else (fallback_category(file.filename or ''), '', 'fallback')
    folder = Path(base.settings.gallery_root) / device_id
    folder.mkdir(parents=True, exist_ok=True)
    stored_name = f'{uuid.uuid4().hex}{suffix}'
    (folder / stored_name).write_bytes(data)
    row = PetMedia(device_id=device_id, user_id=user.id, media_type=media_type, category=category,
                   original_name=(file.filename or '')[:240], stored_name=stored_name, mime_type=mime,
                   size_bytes=len(data), caption=caption.strip(), ai_caption=ai_caption,
                   classified_by=source, captured_at=captured_at or base.utcnow())
    db.add(row); db.commit(); db.refresh(row)
    return media_dict(row)


@app.get('/api/pet/devices/{device_id}/gallery/{media_id}/file')
def gallery_file(device_id: str, media_id: str, user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    base.authorized_device(db, user, device_id)
    row = get_media(db, device_id, media_id)
    path = Path(base.settings.gallery_root) / device_id / row.stored_name
    if not path.is_file():
        raise HTTPException(404, 'فایل روی سرور پیدا نشد')
    return FileResponse(path, media_type=row.mime_type, filename=row.original_name or row.stored_name)


@app.put('/api/pet/devices/{device_id}/gallery/{media_id}')
def update_gallery(device_id: str, media_id: str, body: MediaUpdate, user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    base.authorized_device(db, user, device_id, caregiver=True)
    row = get_media(db, device_id, media_id)
    row.category, row.caption = body.category, body.caption.strip()
    db.commit(); return media_dict(row)


@app.delete('/api/pet/devices/{device_id}/gallery/{media_id}')
def delete_gallery(device_id: str, media_id: str, user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    base.authorized_device(db, user, device_id, caregiver=True)
    row = get_media(db, device_id, media_id)
    path = Path(base.settings.gallery_root) / device_id / row.stored_name
    db.delete(row); db.commit()
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass
    return {'ok': True}
