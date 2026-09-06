(function(){
'use strict';

const ccSleep=ms=>new Promise(r=>setTimeout(r,ms));
let ccCommandTimer=null;
let ccHeartbeatTimer=null;
let ccTelemetryTimer=null;
let ccCommandBusy=false;
let ccControlStarted=false;

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

// Anything in the old code that asks to start command polling now gets the
// always-on implementation, rather than a loop coupled to successful WebRTC.
try{startCommands=ccStartCommands}catch{}

// startCamera may fail/retry because of camera/WebRTC. Remote torch, low power,
// telemetry and talk wake must remain available throughout those retries.
try{
  const baseStartCamera=startCamera;
  startCamera=async function(...args){
    ccStartControlPlane();
    try{return await baseStartCamera(...args)}
    finally{ccStartControlPlane()}
  };
}catch{}

// When the normal stream reaches startLoops, preserve motion/audio detection
// while making sure it cannot replace the independent command loop.
try{
  const baseStartLoops=startLoops;
  startLoops=function(){
    try{baseStartLoops()}finally{ccStartControlPlane()}
  };
}catch{}

// Pairing happens after this file has loaded on a fresh install, so hook the
// pair action as well and start the control plane as soon as credentials exist.
try{
  const basePairNow=pairNow;
  pairNow=async function(...args){
    const r=await basePairNow(...args);
    ccStartControlPlane();
    return r;
  };
}catch{}

['focus','online','pageshow'].forEach(name=>window.addEventListener(name,()=>setTimeout(ccStartControlPlane,50)));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(ccStartControlPlane,50)});

setTimeout(ccStartControlPlane,0);
setTimeout(ccStartControlPlane,700);
setTimeout(ccStartControlPlane,2500);

window.__camcamCameraControlV2=true;
})();
