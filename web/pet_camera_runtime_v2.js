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
})();
