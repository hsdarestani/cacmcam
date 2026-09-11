(function(){
'use strict';

function ccCameraFont(){
  if(document.getElementById('cc-camera-companion-style'))return;
  const style=document.createElement('style');
  style.id='cc-camera-companion-style';
  style.textContent=`
    @font-face{font-family:Vazirmatn;src:url('/static/fonts/Vazirmatn.woff2') format('woff2');font-weight:100 900;font-display:swap}
    body,button,input,select,textarea{font-family:Vazirmatn,Tahoma,Arial,sans-serif!important}
    .state{font-size:11px!important}.state b{font-size:13px!important}
    .muted,.health{font-size:12px!important}
    .row .btn{font-size:12px!important}
    #pair .muted{font-size:11px!important}
  `;
  document.head.appendChild(style);
}

async function ccDetectCapabilities(){
  const track=raw?.getVideoTracks?.()[0]||null;
  let cap={};
  try{cap=track?.getCapabilities?.()||{}}catch{}
  let videoInputs=0;
  try{
    const devices=await navigator.mediaDevices?.enumerateDevices?.();
    videoInputs=(devices||[]).filter(x=>x.kind==='videoinput').length;
  }catch{}
  const audioTrack=raw?.getAudioTracks?.()[0]||null;
  const payload={
    torch_supported:!!cap.torch,
    zoom_supported:!!cap.zoom||!!document.getElementById('sendCanvas')?.captureStream,
    camera_switch_supported:videoInputs>1,
    speech_supported:typeof Audio!=='undefined'||!!window.speechSynthesis||!!window.CamCamNative?.speak,
    sound_detection_supported:!!audioTrack&&!!(window.AudioContext||window.webkitAudioContext),
    talk_supported:typeof RTCPeerConnection!=='undefined'&&!!document.getElementById('talkAudio'),
    battery_supported:!!window.CamCamNative?.getBatteryInfo
  };
  return payload;
}

function ccToggleState(id,show){
  const el=document.getElementById(id);
  const box=el?.closest('.state');
  if(box)box.style.display=show?'':'none';
}

function ccApplyLocalCapabilities(caps){
  ccToggleState('torchState',caps.torch_supported!==false);
  ccToggleState('zoomState',caps.zoom_supported!==false);
  ccToggleState('soundState',caps.sound_detection_supported!==false);
  ccToggleState('talkState',caps.talk_supported!==false);
  const rotate=[...document.querySelectorAll('.row .btn')].find(x=>(x.getAttribute('onclick')||'').includes('rotateLocal'));
  if(rotate)rotate.style.display=caps.camera_switch_supported===false?'none':'';
}

async function ccPublishCapabilities(){
  if(!creds||manualStop)return;
  try{
    const caps=await ccDetectCapabilities();
    ccApplyLocalCapabilities(caps);
    await req('/api/pet/device/capabilities',{
      method:'POST',
      headers:hdr(),
      body:JSON.stringify(caps)
    });
  }catch{}
}

ccCameraFont();
setInterval(ccPublishCapabilities,20000);
['online','focus','pageshow'].forEach(name=>window.addEventListener(name,()=>setTimeout(ccPublishCapabilities,250)));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(ccPublishCapabilities,250)});

try{
  const baseStartCamera=startCamera;
  startCamera=async function(...args){
    const result=await baseStartCamera(...args);
    setTimeout(ccPublishCapabilities,500);
    return result;
  };
}catch{}

try{
  const basePairNow=pairNow;
  pairNow=async function(...args){
    const result=await basePairNow(...args);
    setTimeout(ccPublishCapabilities,500);
    return result;
  };
}catch{}

setTimeout(ccPublishCapabilities,1200);
setTimeout(ccPublishCapabilities,4000);
window.__camcamCameraCompanionV1=true;
})();
