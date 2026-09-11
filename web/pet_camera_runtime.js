(function(){
'use strict';
const sleep2=ms=>new Promise(r=>setTimeout(r,ms));

function cameraStyle(){
  if(document.getElementById('camcam-camera-pro-ui'))return;
  const s=document.createElement('style');s.id='camcam-camera-pro-ui';s.textContent=`
  :root{--bg:#f3f1ec!important;--card:#fffdfa!important;--ink:#102c2a!important;--muted:#71807b!important;--brand:#0b6f69!important;--line:#e1ddd5!important;--bad:#b3495a!important}
  body{background:radial-gradient(circle at 90% -8%,rgba(23,149,139,.13),transparent 30%),linear-gradient(180deg,#faf8f3,#f1efe9)!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif!important;min-height:100vh}
  .wrap{max-width:860px!important;padding:14px 16px 34px!important}.head{height:68px!important;margin:0 0 12px!important;position:sticky;top:0;z-index:20;background:rgba(248,246,241,.86);backdrop-filter:blur(20px);border-bottom:1px solid rgba(222,217,208,.72);padding:0 2px}
  .brand{font-size:19px!important;letter-spacing:-.3px!important}.brand small{font-size:9px!important}.head .btn{border-radius:12px!important;background:rgba(255,255,255,.72)!important}
  .card{border-radius:24px!important;border:1px solid #e0dbd2!important;background:rgba(255,253,250,.92)!important;padding:13px!important;box-shadow:0 16px 44px rgba(20,47,43,.08)!important;margin-bottom:11px!important}
  #pair{max-width:560px;margin:10vh auto 0!important;padding:20px!important}#pair>b{font-size:20px;display:block;margin-bottom:5px}.field input{border-radius:15px!important;border-color:#ddd7cd!important;background:#fff!important;padding:15px!important}
  #pair .btn.primary{min-height:50px;border-radius:15px!important}
  .video{border-radius:22px!important;border:1px solid #173a37!important;box-shadow:0 16px 38px rgba(5,24,22,.2)!important;background:#020706!important}.video video{object-fit:contain!important;background:#000!important}.badge{right:11px!important;top:11px!important;border-radius:999px!important;padding:7px 10px!important;background:rgba(255,252,245,.92)!important;backdrop-filter:blur(10px);box-shadow:0 5px 14px rgba(0,0,0,.09)!important}
  #status{margin:10px 2px 4px!important}.grid{grid-template-columns:repeat(6,1fr)!important;gap:7px!important;margin-top:11px!important}.state{border-radius:14px!important;border:1px solid #e5e0d8!important;background:#f8f7f3!important;padding:9px 6px!important;font-size:8px!important}.state b{font-size:10px!important;margin-top:5px!important;color:#163f3b!important}
  .health{border-radius:14px!important;padding:10px 11px!important;background:#edf5f2!important;border:1px solid #d8e8e3!important;color:#365c56!important;font-size:9px!important}
  .row{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:7px!important}.row .btn{min-width:0!important;min-height:46px;border-radius:14px!important;font-size:9px!important}.row .btn.primary{box-shadow:0 10px 22px rgba(11,111,105,.16)!important}
  #telemetry{margin:6px 0 0!important;background:#f7f5f1;border-radius:13px;padding:10px!important;color:#506a65!important}
  .low{background:#020303!important;color:#6b7775!important;z-index:999!important;flex-direction:column;gap:18px}.low:before{content:'🐾';font-size:36px;opacity:.18}.low button{background:#080a09!important;color:#5f6b69!important;border:1px solid #121716!important;border-radius:20px!important;padding:20px 24px!important;font-size:12px!important}.low button small{font-size:9px!important;color:#46504e!important}.low.show{display:flex!important}
  @media(max-width:620px){.wrap{padding:8px 9px 24px!important}.head{height:60px!important}.brand{font-size:17px!important}.card{padding:9px!important;border-radius:20px!important}.video{border-radius:18px!important}.grid{grid-template-columns:repeat(3,1fr)!important}.row{grid-template-columns:1fr 1fr!important}.row .btn{min-height:44px!important}.health{font-size:8px!important}.state{padding:8px 5px!important}#pair{margin-top:7vh!important}}
  `;document.head.appendChild(s);
}

cameraStyle();

async function publishTruth(){try{await telemetry()}catch{}}

async function hardReleaseTorchOff(){
  clearTimeout(retryTimer);
  try{if(pc)pc.close()}catch{}pc=null;
  clearInterval(drawTimer);drawTimer=null;
  try{if(out&&out!==raw)out.getTracks().forEach(t=>t.stop())}catch{}
  try{if(raw)raw.getTracks().forEach(t=>t.stop())}catch{}
  out=null;raw=null;try{$('preview').srcObject=null}catch{}
  await sleep2(420);
  let nativeResult=false;
  try{if(window.CamCamNative?.forceTorchOff)nativeResult=!!window.CamCamNative.forceTorchOff()}catch{}
  await sleep2(150);torch=false;try{states()}catch{}await publishTruth();
  setTimeout(()=>{try{if(creds&&!manualStop)startCamera(true,false)}catch{}},150);
  return nativeResult;
}

setTorch=async function(on){
  const t=raw?.getVideoTracks?.()[0];
  if(!t)return{ok:false,message:'دوربین هنوز آماده نیست.'};
  if(on){
    try{
      const cap=t.getCapabilities?.();
      if(!cap?.torch)return{ok:false,message:'چراغ این دوربین از داخل اپ پشتیبانی نمی‌شود.'};
      await t.applyConstraints({advanced:[{torch:true}]});await sleep2(180);
      const st=t.getSettings?.();if(st&&Object.prototype.hasOwnProperty.call(st,'torch')&&st.torch!==true)return{ok:false,message:'گوشی فرمان روشن‌کردن چراغ را نپذیرفت.'};
      torch=true;states();await publishTruth();return{ok:true,message:'چراغ روشن شد.'};
    }catch(e){return{ok:false,message:'چراغ روشن نشد.'}}
  }
  try{
    await t.applyConstraints({advanced:[{torch:false}]});await sleep2(220);
    const st=t.getSettings?.();
    if(!st||!Object.prototype.hasOwnProperty.call(st,'torch')||st.torch===false){torch=false;states();await publishTruth();return{ok:true,message:'چراغ خاموش شد.'};}
  }catch{}
  await hardReleaseTorchOff();
  return{ok:true,message:'چراغ خاموش شد و دوربین برای آزادسازی فلش دوباره متصل می‌شود.'};
};

setLowPower=async function(on){
  lowPower=!!on;try{$('low').classList.toggle('show',lowPower)}catch{}
  try{
    const version=window.CamCamNative?.getRuntimeVersion?.();
    if(version&&version!=='1.4.0')window.CamCamNative.setLowPower(lowPower);
    else if(!lowPower)window.CamCamNative?.setLowPower?.(false);
  }catch{}
  await publishTruth();
};

const AUDIO={'بیا پیشم':'/static/audio/bia-pisham.ogg','نه عزیزم':'/static/audio/na-azizam.ogg','غذات آماده‌ست':'/static/audio/ghazat-amadast.ogg'};
const oldSay=say;let phraseAudio=null;
say=function(text){
  text=String(text||'').trim();if(!text)return false;
  const src=AUDIO[text],mic=raw?.getAudioTracks?.()[0],was=mic?.enabled;if(mic)mic.enabled=false;
  const restore=()=>{if(mic&&was!==undefined)mic.enabled=was};
  if(src){
    try{
      if(phraseAudio){phraseAudio.pause();phraseAudio.src=''}
      phraseAudio=new Audio(src+'?v=6');phraseAudio.volume=1;phraseAudio.preload='auto';
      phraseAudio.addEventListener('ended',restore,{once:true});phraseAudio.addEventListener('error',()=>{restore();try{oldSay(text)}catch{}},{once:true});
      phraseAudio.play().catch(()=>{restore();try{oldSay(text)}catch{}});setTimeout(restore,5500);return true;
    }catch{restore()}
  }
  try{const ok=oldSay(text);setTimeout(restore,4500);return !!ok}catch{restore();return false}
};

const oldTelemetry=telemetry;
telemetry=async function(){
  try{await oldTelemetry()}finally{
    try{
      const info={};if(window.CamCamNative?.getBatteryInfo)Object.assign(info,JSON.parse(window.CamCamNative.getBatteryInfo()));
      await req('/api/pet/device/telemetry',{method:'POST',headers:hdr(),body:JSON.stringify({...info,low_power:!!lowPower,torch:!!torch,codec:window.codec||null,facing,quality:settings.quality,zoom:Number(zoom)||1,talk_connected:talkPc?.connectionState==='connected'})});
    }catch{}
  }
};

ack=async function(c,ok,message,extra={}){
  try{await publishTruth()}catch{}
  try{
    await event('control_ack',ok?100:0,{command_id:String(c?.id||''),type:c?.type,value:c?.value,ok:!!ok,message:String(message||''),applied_at:new Date().toISOString(),...extra},false);
  }catch{}
};

startCommands=function(){
  clearInterval(cmdTimer);let busy=false;
  const poll=async()=>{
    if(busy||!creds)return;busy=true;
    try{const rows=await req('/api/pet/device/commands',{headers:hdr()});for(const c of rows)await applyCommand(c)}catch{}finally{busy=false}
  };
  poll();cmdTimer=setInterval(poll,650);
};

document.addEventListener('visibilitychange',()=>{if(!document.hidden&&creds){try{startCommands();publishTruth()}catch{}}});
window.addEventListener('focus',()=>{if(creds)try{publishTruth()}catch{}});
(function(){
'use strict';

const ccSleep=ms=>new Promise(r=>setTimeout(r,ms));
let ccCommandTimer=null;
let ccHeartbeatTimer=null;
let ccTelemetryTimer=null;
let ccPublisherWatchTimer=null;
let ccCommandBusy=false;
let ccControlStarted=false;
let ccPublisherUnhealthySince=0;
let ccLastPublisherAttempt=0;
let ccPublisherRecoveryBusy=false;

async function ccPollCommands(){
  if(ccCommandBusy||!creds||manualStop)return;
  ccCommandBusy=true;
  try{
    const rows=await req('/api/pet/device/commands',{headers:hdr()});
    for(const c of (rows||[]))await applyCommand(c);
  }catch(e){
    // Media publishing and the control plane are intentionally independent.
  }finally{
    ccCommandBusy=false;
  }
}

function ccStartCommands(){
  try{clearInterval(cmdTimer)}catch{}
  if(ccCommandTimer)clearInterval(ccCommandTimer);
  ccPollCommands();
  ccCommandTimer=setInterval(ccPollCommands,550);
}

function ccStartHeartbeat(){
  if(ccHeartbeatTimer)clearInterval(ccHeartbeatTimer);
  const beat=()=>{if(creds&&!manualStop)req('/api/device/heartbeat',{method:'POST',headers:hdr()}).catch(()=>{})};
  beat();
  ccHeartbeatTimer=setInterval(beat,9000);
}

function ccStartTelemetry(){
  if(ccTelemetryTimer)clearInterval(ccTelemetryTimer);
  const send=()=>{if(creds&&!manualStop)Promise.resolve(telemetry()).catch(()=>{})};
  send();
  ccTelemetryTimer=setInterval(send,4000);
}

function ccStartControlPlane(){
  if(!creds||manualStop)return;
  ccStartCommands();
  ccStartHeartbeat();
  ccStartTelemetry();
  try{startTalkWake()}catch{}
  ccControlStarted=true;
  try{
    const el=document.getElementById('telemetry');
    if(el&&!el.dataset.ccControlReady){
      el.dataset.ccControlReady='1';
      const old=el.textContent||'';
      el.textContent=(old?old+' · ':'')+'کنترل راه‌دور آماده';
    }
  }catch{}
}

function ccSourceDimensions(video,maxW,maxH){
  let trackSettings={};
  try{trackSettings=raw?.getVideoTracks?.()[0]?.getSettings?.()||{}}catch{}
  const sourceW=Number(video?.videoWidth||trackSettings.width||maxW)||maxW;
  const sourceH=Number(video?.videoHeight||trackSettings.height||maxH)||maxH;
  return [Math.max(2,sourceW),Math.max(2,sourceH)];
}

function ccOutputDimensions(video,maxW,maxH){
  const [sourceW,sourceH]=ccSourceDimensions(video,maxW,maxH);
  const portrait=sourceH>sourceW;
  const boundW=portrait?maxH:maxW;
  const boundH=portrait?maxW:maxH;
  const scale=Math.min(1,boundW/sourceW,boundH/sourceH);
  const even=n=>Math.max(2,Math.round((n*scale)/2)*2);
  return [even(sourceW),even(sourceH)];
}

function ccDrawUndistorted(video,canvas){
  if(!video?.videoWidth||!video?.videoHeight||!canvas?.width||!canvas?.height)return;
  const vw=video.videoWidth,vh=video.videoHeight;
  const targetAspect=canvas.width/canvas.height;
  const z=Math.max(1,Number(digitalZoom)||1);
  let sw=vw/z,sh=vh/z;

  // The output canvas follows the camera's native orientation/aspect ratio.
  // If a device reports slightly different dimensions after capture starts,
  // crop minimally to the canvas ratio rather than stretching the picture.
  if(sw/sh>targetAspect)sw=sh*targetAspect;
  else sh=sw/targetAspect;
  const sx=(vw-sw)/2,sy=(vh-sh)/2;
  canvas.getContext('2d').drawImage(video,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
}

// The historical camera page sized width and height independently against a
// 16:9 quality box. Portrait/4:3 camera feeds could therefore be squeezed into
// a different ratio before WebRTC ever saw them. Publish a canvas that keeps the
// physical camera aspect ratio exactly; quality only limits the long/short edge.
try{
  prepareOutput=function(){
    clearInterval(drawTimer);
    const video=document.getElementById('preview');
    const canvas=document.getElementById('sendCanvas');
    const [maxW,maxH]=dims();
    const [cw,ch]=ccOutputDimensions(video,maxW,maxH);
    canvas.width=cw;
    canvas.height=ch;

    if(canvas.captureStream){
      const draw=()=>ccDrawUndistorted(video,canvas);
      draw();
      const captured=canvas.captureStream(20);
      out=new MediaStream();
      captured.getVideoTracks().forEach(track=>out.addTrack(track));
      raw?.getAudioTracks?.().forEach(track=>out.addTrack(track));
      drawTimer=setInterval(draw,50);
    }else{
      out=raw;
    }
  };
}catch(e){console.warn('CamCam aspect-safe publisher',e)}

function ccPublisherState(){
  try{return pc?.connectionState||'none'}catch{return 'none'}
}

function ccMarkPublisherState(text,kind=''){
  try{
    const current=ccPublisherState();
    if(current==='connected')return;
    badge(text,kind);
    const status=document.getElementById('status');
    if(status)status.textContent='گوشی آنلاین است؛ اتصال تصویر به‌صورت خودکار بازیابی می‌شود.';
  }catch{}
}

async function ccRecoverPublisher(reason='watchdog'){
  if(!creds||manualStop||starting||ccPublisherRecoveryBusy)return;
  const now=Date.now();
  if(now-ccLastPublisherAttempt<3500)return;
  ccLastPublisherAttempt=now;
  ccPublisherUnhealthySince=now;
  ccPublisherRecoveryBusy=true;
  ccMarkPublisherState('بازیابی تصویر','err');
  try{
    try{if(pc)pc.close()}catch{}
    pc=null;
    await ccSleep(180);
    await startCamera(false,false);
  }catch(e){
    ccMarkPublisherState('بازیابی تصویر','err');
  }finally{
    ccPublisherRecoveryBusy=false;
  }
}

function ccWatchPublisher(){
  if(!creds||manualStop)return;
  const state=ccPublisherState();
  const now=Date.now();

  if(state==='connected'){
    ccPublisherUnhealthySince=0;
    return;
  }

  if(!ccPublisherUnhealthySince)ccPublisherUnhealthySince=now;
  const unhealthyFor=now-ccPublisherUnhealthySince;

  // Allow normal ICE setup and brief mobile-network handoffs to settle before
  // tearing the publisher down. Persistent disconnects are republished.
  if(state==='new'||state==='connecting'){
    if(unhealthyFor>14000)ccRecoverPublisher('connect-timeout');
    return;
  }
  if(state==='disconnected'){
    if(unhealthyFor>2500)ccRecoverPublisher('disconnected');
    return;
  }
  if(state==='failed'||state==='closed'||state==='none'){
    if(unhealthyFor>1200)ccRecoverPublisher(state);
  }
}

function ccStartPublisherWatchdog(){
  if(ccPublisherWatchTimer)clearInterval(ccPublisherWatchTimer);
  ccPublisherWatchTimer=setInterval(ccWatchPublisher,1200);
  setTimeout(ccWatchPublisher,900);
}

// Anything in the old code that asks to start command polling now gets the
// always-on implementation, rather than a loop coupled to successful WebRTC.
try{startCommands=ccStartCommands}catch{}

// startCamera may fail/retry because of camera/WebRTC. Remote torch, low power,
// telemetry and talk wake must remain available throughout those retries.
try{
  const baseStartCamera=startCamera;
  startCamera=async function(...args){
    ccStartControlPlane();
    ccStartPublisherWatchdog();
    try{
      const result=await baseStartCamera(...args);
      if(ccPublisherState()==='connected')ccPublisherUnhealthySince=0;
      return result;
    }finally{
      ccStartControlPlane();
      ccStartPublisherWatchdog();
    }
  };
}catch{}

// When the normal stream reaches startLoops, preserve motion/audio detection
// while making sure it cannot replace the independent command loop.
try{
  const baseStartLoops=startLoops;
  startLoops=function(){
    try{baseStartLoops()}finally{
      ccStartControlPlane();
      ccStartPublisherWatchdog();
    }
  };
}catch{}

// Pairing happens after this file has loaded on a fresh install, so hook the
// pair action as well and start the control plane as soon as credentials exist.
try{
  const basePairNow=pairNow;
  pairNow=async function(...args){
    const r=await basePairNow(...args);
    ccStartControlPlane();
    ccStartPublisherWatchdog();
    return r;
  };
}catch{}

['focus','online','pageshow'].forEach(name=>window.addEventListener(name,()=>{
  setTimeout(ccStartControlPlane,50);
  setTimeout(ccWatchPublisher,120);
}));
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden){
    setTimeout(ccStartControlPlane,50);
    setTimeout(ccWatchPublisher,120);
  }
});

setTimeout(ccStartControlPlane,0);
setTimeout(ccStartControlPlane,700);
setTimeout(ccStartControlPlane,2500);
setTimeout(ccStartPublisherWatchdog,0);

window.__camcamCameraControlV2=true;
window.__camcamPublisherRecoveryV1=true;
window.__camcamAspectSafePublisherV1=true;
})();
})();function installFinal(){
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

installFinal();
