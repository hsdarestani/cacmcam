(function(){
'use strict';

function load(src,done){
  const s=document.createElement('script');
  s.src=src;
  s.async=false;
  s.onload=()=>done&&done();
  s.onerror=()=>done&&done();
  document.head.appendChild(s);
}

function installFinal(){
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  try{
    const previousAck=ack;
    const previousTelemetry=telemetry;

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
        const a=[];
        if(info.battery!=null)a.push('باتری '+info.battery+'٪');
        if(info.charging!=null)a.push(info.charging?'در حال شارژ':'بدون شارژر');
        a.push('کیفیت '+settings.quality);
        a.push('زوم '+(Number(zoom)||1).toFixed(1)+'×');
        a.push(torch?'چراغ روشن':'چراغ خاموش');
        a.push(lowPower?'کم‌مصرف روشن':'کم‌مصرف خاموش');
        const box=document.getElementById('telemetry');
        if(box)box.textContent=a.join(' · ');
        return payload;
      }catch(e){
        try{return await previousTelemetry()}catch{}
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
        extra:{
          ...extra,
          torch:!!torch,
          low_power:!!lowPower,
          zoom:Number(zoom)||1,
          facing
        }
      };

      let sent=false;
      for(let i=0;i<8&&!sent;i++){
        try{
          await req('/api/pet/device/command-ack',{method:'POST',headers:hdr(),body:JSON.stringify(payload)});
          sent=true;
        }catch{
          await wait(100+i*120);
        }
      }

      try{await previousAck(c,ok,message,extra)}catch{}
      try{await telemetry()}catch{}
      return sent;
    };

    // Make the physical state visible immediately after a command, not only on
    // the periodic telemetry timer.
    const baseSetTorch=setTorch;
    setTorch=async function(on){
      const r=await baseSetTorch(on);
      try{await telemetry()}catch{}
      return r;
    };

    const baseSetLowPower=setLowPower;
    setLowPower=async function(on){
      const r=await baseSetLowPower(on);
      try{await telemetry()}catch{}
      return r;
    };

    try{telemetry()}catch{}
    window.__camcamCameraRuntimeFinal='12-direct';
    document.documentElement.dataset.camcamCameraRuntime='12-direct';
  }catch(e){console.warn('CamCam final camera runtime',e)}
}

// Keep the chain limited to production routes that definitely exist.
load('/static/pet_camera_visual.js?v=12',()=>
  load('/static/pet_camera_runtime_v2.js?v=12',installFinal)
);
})();
