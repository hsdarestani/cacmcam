(function(){
'use strict';

const cc4Sleep=ms=>new Promise(r=>setTimeout(r,ms));
const previousAck=ack;

ack=async function(c,ok,message,extra={}){
  const payload={
    command_id:String(c?.id||''),
    type:String(c?.type||''),
    value:c?.value,
    ok:!!ok,
    message:String(message||''),
    applied_at:new Date().toISOString(),
    extra:{...extra}
  };

  let direct=false;
  for(let attempt=0;attempt<6&&!direct;attempt++){
    try{
      await req('/api/pet/device/command-ack',{
        method:'POST',headers:hdr(),body:JSON.stringify(payload)
      });
      direct=true;
    }catch{
      await cc4Sleep(120+attempt*160);
    }
  }

  // Keep the historical event ACK as a compatibility fallback for older viewers.
  try{await previousAck(c,ok,message,extra)}catch{}
  try{await publishTruth()}catch{}
  return direct;
};

window.__camcamCameraRuntimeV4=true;
})();
