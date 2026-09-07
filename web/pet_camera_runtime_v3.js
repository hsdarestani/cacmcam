(function(){
'use strict';

const cc3Sleep=ms=>new Promise(r=>setTimeout(r,ms));

// Final ACK layer. Older code wrote command confirmations through the generic
// event helper, which intentionally swallowed network errors. A command could
// therefore be applied successfully while the viewer never saw its ACK.
ack=async function(c,ok,message,extra={}){
  try{await publishTruth()}catch{}
  const body={
    kind:'control_ack',
    confidence:ok?100:0,
    metadata:{
      command_id:String(c?.id||''),
      type:c?.type,
      value:c?.value,
      ok:!!ok,
      message:String(message||''),
      applied_at:new Date().toISOString(),
      ...extra
    },
    snapshot_data_url:null
  };

  let sent=false;
  for(let attempt=0;attempt<4&&!sent;attempt++){
    try{
      await req('/api/pet/device/event',{method:'POST',headers:hdr(),body:JSON.stringify(body)});
      sent=true;
    }catch{
      await cc3Sleep(160+attempt*180);
    }
  }

  // Telemetry is an independent source of truth for stateful controls, so keep
  // it fresh even if the event store was temporarily unavailable.
  try{await publishTruth()}catch{}
  return sent;
};

// When a talk wake arrives the publisher should already exist (viewer runtime
// v3 publishes before waking us). Retry quickly anyway, because MediaMTX may need
// a few hundred milliseconds before the path becomes readable.
try{
  const baseStartTalk=startTalk;
  let receiverRetryTimer=null;
  startTalk=async function(){
    clearTimeout(receiverRetryTimer);
    let last=null;
    for(let i=0;i<5;i++){
      try{
        await baseStartTalk();
        if(talkPc&&['new','connecting','connected'].includes(talkPc.connectionState))return;
      }catch(e){last=e}
      await cc3Sleep(220+i*80);
    }
    if(last)throw last;
    receiverRetryTimer=setTimeout(()=>{try{baseStartTalk()}catch{}},900);
  };
}catch(e){console.warn('CamCam camera talk v3',e);}

window.__camcamCameraRuntimeV3=true;
})();
