import os
import sys
import tempfile
import unittest
from pathlib import Path


DB_FILE = Path(tempfile.gettempdir()) / 'camcam-subscription-test.db'
if DB_FILE.exists():
    DB_FILE.unlink()
os.environ['DATABASE_URL'] = f'sqlite:///{DB_FILE}'
os.environ['REDIS_URL'] = 'redis://127.0.0.1:1/0'
os.environ['WEB_DIR'] = str(Path(__file__).resolve().parents[1] / 'web')
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))

import app  # noqa: E402


class SubscriptionTest(unittest.TestCase):
    def test_single_premium_plan_is_199_thousand_toman(self):
        plans = app.public_plans()
        self.assertEqual(len(plans), 1)
        self.assertEqual(plans[0]['code'], 'premium_monthly')
        self.assertEqual(plans[0]['amount_rial'], 1_990_000)
        self.assertTrue(plans[0]['all_features'])
        self.assertEqual(plans[0]['trial_days'], 7)


if __name__ == '__main__':
    unittest.main()
