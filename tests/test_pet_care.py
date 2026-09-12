import os
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock, patch
from datetime import timedelta
from pathlib import Path

from fastapi.testclient import TestClient


DB_FILE = Path(tempfile.gettempdir()) / 'camcam-pet-care-test.db'
if DB_FILE.exists():
    DB_FILE.unlink()
os.environ['DATABASE_URL'] = f'sqlite:///{DB_FILE}'
os.environ['REDIS_URL'] = 'redis://127.0.0.1:1/0'
os.environ['GALLERY_ROOT'] = str(Path(tempfile.gettempdir()) / 'camcam-pet-gallery-test')
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))

import pet_app as base  # noqa: E402
import pet_entrypoint  # noqa: E402,F401


class PetCareApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base.Base.metadata.create_all(base.engine)
        with base.SessionLocal() as db:
            db.add(base.User(id='owner', email='owner@example.com',
                             trial_ends_at=base.utcnow() + timedelta(days=2)))
            db.add(base.Device(id='camera', owner_id='owner', name='اتاق پت'))
            db.commit()
        cls.client = TestClient(base.app)
        cls.client.cookies.set('camcam_session', base.make_token(
            {'sub': 'owner', 'scope': 'session'}, 3600))

    def test_profile_persists_extended_fields(self):
        payload = {'breed': 'Persian', 'birth_date': '2022-01-02', 'sex': 'female',
                   'weight_kg': 4.2, 'microchip': '123', 'vet_name': 'دکتر الف',
                   'vet_phone': '021', 'notes': 'آرام', 'photo_data_url': '',
                   'sterilized': True, 'allergies': 'مرغ', 'medical_notes': 'ندارد'}
        self.assertEqual(self.client.put('/api/pet/devices/camera/profile', json=payload).status_code, 200)
        saved = self.client.get('/api/pet/devices/camera/profile').json()
        self.assertEqual(saved['allergies'], 'مرغ')
        self.assertTrue(saved['sterilized'])

    def test_routine_completion_and_quick_log_persist(self):
        task = self.client.post('/api/pet/devices/camera/care/tasks', json={
            'title': 'غذای عصر', 'kind': 'feed', 'time_of_day': '18:00',
            'days': list(range(7)), 'enabled': True}).json()
        done = self.client.post(f"/api/pet/devices/camera/care/tasks/{task['id']}/done",
                                json={'local_date': '2026-09-11', 'note': ''})
        self.assertEqual(done.status_code, 200)
        log = self.client.post('/api/pet/devices/camera/care/logs', json={
            'local_date': '2026-09-11', 'kind': 'toilet', 'title': 'دستشویی', 'note': ''})
        self.assertEqual(log.status_code, 200)
        today = self.client.get('/api/pet/devices/camera/care/today?local_date=2026-09-11').json()
        self.assertIn(task['id'], today['done_task_ids'])
        self.assertTrue(any(item['kind'] == 'toilet' for item in today['logs']))

    def test_health_log_and_timeline(self):
        response = self.client.post('/api/pet/devices/camera/health-logs', json={
            'kind': 'weight', 'value': '4.2 kg', 'note': 'صبح'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get('/api/pet/devices/camera/health-logs').json()[0]['kind'], 'weight')
        timeline = self.client.get('/api/pet/devices/camera/timeline')
        self.assertEqual(timeline.status_code, 200)
        self.assertTrue(any(item['type'] == 'health' for item in timeline.json()))

    def test_ai_status_and_daily_usage(self):
        status = self.client.get('/api/pet/devices/camera/ai/status')
        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.json()['daily_limit'], base.settings.ai_trial_daily_limit)
        with patch('pet_ai.cloudflare_answer', new=AsyncMock(return_value='پاسخ آزمایشی')):
            answer = self.client.post('/api/pet/devices/camera/ai/ask', json={'question': 'حال پت من چطور است؟'})
        self.assertEqual(answer.status_code, 200)
        self.assertEqual(answer.json()['answer'], 'پاسخ آزمایشی')
        self.assertEqual(answer.json()['remaining'], base.settings.ai_trial_daily_limit - 1)

    def test_management_item_dashboard_and_repeat(self):
        created = self.client.post('/api/pet/devices/camera/management/items', json={
            'category': 'medication', 'title': 'قرص ضد انگل',
            'due_at': '2026-09-13T08:00:00Z', 'repeat_days': 30,
            'provider': 'دکتر الف', 'dosage': 'نصف قرص', 'notes': '', 'metadata': {},
        })
        self.assertEqual(created.status_code, 200)
        item = created.json()
        dashboard = self.client.get('/api/pet/devices/camera/management/dashboard').json()
        self.assertGreaterEqual(dashboard['counts']['medications'], 1)
        completed = self.client.post(f"/api/pet/devices/camera/management/items/{item['id']}/complete")
        self.assertEqual(completed.status_code, 200)
        self.assertIsNotNone(completed.json()['next_item'])
        self.assertEqual(completed.json()['next_item']['dosage'], 'نصف قرص')

    def test_gallery_upload_list_update_and_file(self):
        uploaded = self.client.post('/api/pet/devices/camera/gallery', files={
            'file': ('play-ball.jpg', b'fake-jpeg-for-api-test', 'image/jpeg'),
        }, data={'caption': 'بازی در خانه'})
        self.assertEqual(uploaded.status_code, 200, uploaded.text)
        media = uploaded.json()
        self.assertEqual(media['category'], 'play')
        self.assertEqual(media['classified_by'], 'fallback')
        rows = self.client.get('/api/pet/devices/camera/gallery').json()
        self.assertTrue(any(item['id'] == media['id'] for item in rows))
        changed = self.client.put(f"/api/pet/devices/camera/gallery/{media['id']}", json={
            'category': 'family', 'caption': 'کنار خانواده',
        })
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.json()['category'], 'family')
        served = self.client.get(media['url'])
        self.assertEqual(served.status_code, 200)
        self.assertEqual(served.content, b'fake-jpeg-for-api-test')


if __name__ == '__main__':
    unittest.main()
