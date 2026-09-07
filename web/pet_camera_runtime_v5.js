(function(){
'use strict';

const cc5Sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cc5PreviousAck=ack;
const cc5PreviousTelemetry=telemetry;

telemetry=async function(){
  try{
    let info={};
    if(window.CamCamNative?.getBatteryInfo)info=JSON.parse(window.CamCamNative.getBatteryInfo());
    const payload={
      ...info,
      low_power:!!lowPower,
      torch:!!torch,
      zoom:Number(zoom)||1,
      codec:window.codec||null,
      facing,
      quality:settings.quality,
      talk_connected:talkPc?.connectionState==='connected'
    };
    await req('/api/pet/device/telemetry',{method:'POST',headers:hdr(),body:JSON.stringify(payload)});
    let a=[];
    if(info.battery!=null)a.push('باتری '+info.battery+'٪');
    if(info.charging!=null)a.push(info.charging?'در حال شارژ':'بدون شارژر');
    a.push('کیفیت '+settings.quality);
    a.push('زوم '+(Number(zoom)||1).toFixed(1)+'×');
    a.push(torch?'چراغ روشن':'چراغ خاموش');
    a.push(lowPower?'کم‌مصرف روشن':'کم‌مصرف خاموش');
    const box=document.getElementById('telemetry');if(box)box.textContent=a.join(' · ');
    return payload;
  }catch(e){
    try{return await cc5PreviousTelemetry()}catch{}
    return null;
  }
};

ack=async function(c,ok,message,extra={}){
  try{await telemetry()}catch{}
  const payload={
    command_id:String(c?.id||''),
    type:String(c?.type||''),
    value:c?.value,
    ok:!!ok,
    message:String(message||''),
    applied_at:new Date().toISOString(),
    extra:{...extra,torch:!!torch,low_power:!!lowPower,zoom:Number(zoom)||1,facing}
  };
  let sent=false;
  for(let attempt=0;attempt<8&&!sent;attempt++){
    try{
      await req('/api/pet/device/command-ack',{method:'POST',headers:hdr(),body:JSON.stringify(payload)});
      sent=true;
    }catch{
      await cc5Sleep(100+attempt*120);
    }
  }
  try{await cc5PreviousAck(c,ok,message,extra)}catch{}
  try{await telemetry()}catch{}
  return sent;
};

window.__camcamCameraRuntimeV5=true;
})();
