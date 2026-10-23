"""Run against a disposable PostgreSQL database; never use production credentials."""
import asyncio,os,sys,uuid,threading,unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"backend"))
import app
from sqlalchemy import select

class CallbackRaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if app.engine.dialect.name!="postgresql":
            raise unittest.SkipTest("Concurrent callbacks require disposable PostgreSQL")
        app.Base.metadata.create_all(app.engine)
    def setUp(self):
        with app.SessionLocal() as db:
            user=app.User(email=str(uuid.uuid4())+"@example.com",password_hash="synthetic-test-only")
            db.add(user);db.flush()
            row=app.Payment(user_id=user.id,plan_code="premium_monthly",amount_rial=1990000)
            db.add(row);db.commit()
            self.uid=user.id;self.pid=row.id
        self.receipt=str(uuid.uuid4())
    def invoke(self,payload,barrier=None):
        class Response:
            def raise_for_status(self):pass
            def json(self):return payload
        class Client:
            def __init__(self,*args,**kwargs):pass
            async def __aenter__(self):return self
            async def __aexit__(self,*args):pass
            async def get(self,*args,**kwargs):
                if barrier: await asyncio.to_thread(barrier.wait,timeout=10)
                return Response()
        def run():
            with app.SessionLocal() as db:
                return asyncio.run(app.payment_return(payment="success",receipt=self.receipt,intent=self.pid,db=db))
        return Client,run
    def paid(self,**overrides):
        return dict(ok=True,status="paid",intent=self.pid,amount_toman=199000,**overrides)
    def test_two_simultaneous_callbacks_grant_one_period(self):
        barrier=threading.Barrier(2)
        Client,run=self.invoke(self.paid(),barrier)
        with patch.object(app.httpx,"AsyncClient",Client):
            with ThreadPoolExecutor(max_workers=2) as pool:
                results=list(pool.map(lambda _:run(),range(2)))
        self.assertTrue(all("payment=success" in r.headers["location"] for r in results))
        with app.SessionLocal() as db:
            row=db.get(app.Payment,self.pid)
            sub=db.scalar(select(app.Subscription).where(app.Subscription.user_id==self.uid))
            self.assertEqual(row.status,"verified")
            self.assertGreater(sub.current_period_end,app.utcnow()+timedelta(days=29))
            self.assertLess(sub.current_period_end,app.utcnow()+timedelta(days=31))
    def test_wrong_amount_never_activates(self):
        payload=self.paid();payload["amount_toman"]=1
        Client,run=self.invoke(payload)
        with patch.object(app.httpx,"AsyncClient",Client):r=run()
        self.assertIn("payment=failed",r.headers["location"])
        with app.SessionLocal() as db:
            self.assertIsNone(db.get(app.Payment,self.pid).activated_at)
            self.assertIsNone(db.scalar(select(app.Subscription).where(app.Subscription.user_id==self.uid)))
    def test_malformed_amount_fails_without_server_error(self):
        payload=self.paid();payload["amount_toman"]="not-a-number"
        Client,run=self.invoke(payload)
        with patch.object(app.httpx,"AsyncClient",Client):r=run()
        self.assertIn("payment=failed",r.headers["location"])
    def test_unverified_receipt_never_activates(self):
        payload=self.paid();payload["intent"]="another-payment"
        Client,run=self.invoke(payload)
        with patch.object(app.httpx,"AsyncClient",Client):r=run()
        self.assertIn("payment=pending",r.headers["location"])
        with app.SessionLocal() as db:self.assertIsNone(db.get(app.Payment,self.pid).activated_at)

if __name__=="__main__":unittest.main()
