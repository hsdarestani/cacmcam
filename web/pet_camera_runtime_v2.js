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
