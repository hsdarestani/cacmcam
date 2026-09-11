(function(){
'use strict';

const ccWait=ms=>new Promise(r=>setTimeout(r,ms));

// ---- Viewer WebRTC lifecycle -------------------------------------------------
// The viewer can stay open for hours. Android/WebView may suspend/resume the
// page, the network can hand off between Wi-Fi/mobile, and several reconnects
// can overlap. Keep every negotiation generation-scoped so an old async answer
// can never be applied to a peer that was already closed by a newer attempt.
let ccWatchGeneration=0;
let ccWatchPendingPc=null;
let ccWatchAbort=null;
let ccWatchdogTimer=null;
let ccWatchdogReconnect=null;
let ccLastVideoTime=-1;
let ccVideoStallTicks=0;
const ccBaseCloseDetail=closeDetail;

function ccCancelled(message='cancelled'){
  const e=new Error(message);
  e.ccCancelled=true;
  return e;
}

function ccCancelWatchPending(){
  try{ccWatchAbort?.abort()}catch{}
  ccWatchAbort=null;
  if(ccWatchPendingPc&&ccWatchPendingPc!==watchPC){
    try{ccWatchPendingPc.close()}catch{}
  }
  ccWatchPendingPc=null;
}

function ccEnsureWatchCurrent(generation,deviceId,p){
  if(generation!==ccWatchGeneration||activeId!==deviceId||p?.signalingState==='closed'){
    throw ccCancelled();
  }
}

async function ccConnectWatch(auth,generation,deviceId){
  const p=newPeer();
  ccWatchPendingPc=p;
  const media=new MediaStream();
  p.addTransceiver('video',{direction:'recvonly'});
  p.addTransceiver('audio',{direction:'recvonly'});
  p.ontrack=e=>{
    if(generation!==ccWatchGeneration||activeId!==deviceId)return;
    if(!media.getTracks().some(t=>t.id===e.track.id))media.addTrack(e.track);
    const v=document.getElementById('liveVideo');
    if(v){v.srcObject=media;v.play().catch(()=>{})}
  };

  try{
    const offer=await p.createOffer();
    ccEnsureWatchCurrent(generation,deviceId,p);
    await p.setLocalDescription(offer);
    await waitIce(p);
    ccEnsureWatchCurrent(generation,deviceId,p);

    const controller=new AbortController();
    ccWatchAbort=controller;
    const timeout=setTimeout(()=>controller.abort(),15000);
    let response;
    try{
      response=await fetch(auth.whep_url,{
        method:'POST',
        headers:{'Content-Type':'application/sdp','Authorization':'Bearer '+auth.token},
        body:p.localDescription.sdp,
        signal:controller.signal
      });
    }finally{
      clearTimeout(timeout);
      if(ccWatchAbort===controller)ccWatchAbort=null;
    }
    ccEnsureWatchCurrent(generation,deviceId,p);
    if(!response.ok){
      const e=new Error('استریم پاسخ نداد ('+response.status+')');
      e.status=response.status;
      throw e;
    }

    const answer=await response.text();
    ccEnsureWatchCurrent(generation,deviceId,p);
    await p.setRemoteDescription({type:'answer',sdp:answer});
    ccEnsureWatchCurrent(generation,deviceId,p);
    return p;
  }catch(e){
    try{p.close()}catch{}
    if(e?.name==='AbortError'&&generation!==ccWatchGeneration)throw ccCancelled();
    if(e?.name==='InvalidStateError'&&p.signalingState==='closed')throw ccCancelled();
    throw e;
  }finally{
    if(ccWatchPendingPc===p)ccWatchPendingPc=null;
  }
}

function ccScheduleWatchdogReconnect(delay=250){
  clearTimeout(ccWatchdogReconnect);
  const id=activeId;
  if(!id)return;
  ccWatchdogReconnect=setTimeout(()=>{
    if(activeId!==id||document.hidden)return;
    const state=watchPC?.connectionState;
    if(state!=='connected'||ccVideoStallTicks>=3){
      try{openLive(id)}catch{}
    }
  },delay);
}

function ccStartWatchdog(){
  if(ccWatchdogTimer)clearInterval(ccWatchdogTimer);
  ccWatchdogTimer=setInterval(()=>{
    if(!activeId||document.hidden)return;
    const p=watchPC;
    const state=p?.connectionState||'none';
    const v=document.getElementById('liveVideo');

    if(state==='failed'||state==='disconnected'||state==='closed'||state==='none'){
      ccVideoStallTicks=0;
      ccScheduleWatchdogReconnect(state==='disconnected'?1800:350);
      return;
    }

    if(state==='connected'&&v){
      const now=Number(v.currentTime||0);
      if(v.readyState>=2&&now>0){
        if(ccLastVideoTime>=0&&Math.abs(now-ccLastVideoTime)<0.05)ccVideoStallTicks++;
        else ccVideoStallTicks=0;
        ccLastVideoTime=now;
        if(ccVideoStallTicks>=3)ccScheduleWatchdogReconnect(250);
      }
    }
  },10000);
}

try{
  connectWatch=ccConnectWatch;

  openLive=async function(id){
    const generation=++ccWatchGeneration;
    ccCancelWatchPending();
    clearTimeout(watchRetry);
    clearTimeout(ccWatchdogReconnect);
    ccVideoStallTicks=0;
    ccLastVideoTime=-1;

    activeId=id;
    activeDevice=devices.find(x=>x.id===id);
    document.getElementById('detail')?.classList.remove('hidden');
    const title=document.getElementById('detailTitle');
    if(title)title.textContent=activeDevice?.pet?.pet_name||activeDevice?.name||'دوربین';
    const access=document.getElementById('access');
    if(access)access.textContent=activeDevice?.access==='owner'?'مالک':activeDevice?.access==='caregiver'?'مراقب':'فقط مشاهده';
    const care=activeDevice?.access!=='viewer';
    ['talk','torch','lowPower','manual','zoomRange','quality'].forEach(key=>{const el=document.getElementById(key);if(el)el.disabled=!care});
    try{showTab('live')}catch{}
    try{syncControl()}catch{}
    try{loadHealth()}catch{}
    try{loadEvents()}catch{}
    try{loadRecordings()}catch{}
    try{loadManual()}catch{}

    if(watchPC){try{watchPC.onconnectionstatechange=null;watchPC.close()}catch{}watchPC=null}
    const stateEl=document.getElementById('liveState');
    if(stateEl)stateEl.textContent='در حال اتصال';

    try{
      const auth=await api(`/api/pet/devices/${id}/watch-token`,{method:'POST'});
      if(generation!==ccWatchGeneration||activeId!==id)throw ccCancelled();
      const p=await ccConnectWatch(auth,generation,id);
      if(generation!==ccWatchGeneration||activeId!==id){try{p.close()}catch{};throw ccCancelled()}
      watchPC=p;
      if(stateEl)stateEl.textContent='● زنده';
      p.onconnectionstatechange=()=>{
        if(watchPC!==p||activeId!==id||generation!==ccWatchGeneration)return;
        const s=p.connectionState;
        if(s==='connected'){
          if(stateEl)stateEl.textContent='● زنده';
          ccVideoStallTicks=0;
          return;
        }
        if(s==='failed'||s==='disconnected'){
          if(stateEl)stateEl.textContent='در حال بازیابی تصویر…';
          clearTimeout(watchRetry);
          watchRetry=setTimeout(()=>{
            if(activeId===id&&watchPC===p&&generation===ccWatchGeneration){
              try{openLive(id)}catch{}
            }
          },s==='failed'?650:2200);
        }
      };
      ccStartWatchdog();
      return p;
    }catch(e){
      if(e?.ccCancelled||generation!==ccWatchGeneration||activeId!==id)return null;
      if(stateEl)stateEl.textContent='تصویر آماده نیست';
      // Never expose low-level WebRTC state errors to the user. The outer
      // recovery runtime decides when/how to retry this attempt.
      toast('تصویر آماده نیست');
      return null;
    }
  };

  closeDetail=function(){
    ccWatchGeneration++;
    ccCancelWatchPending();
    clearTimeout(ccWatchdogReconnect);
    ccVideoStallTicks=0;
    ccLastVideoTime=-1;
    return ccBaseCloseDetail();
  };

  ['online','pageshow','focus'].forEach(name=>window.addEventListener(name,()=>{
    if(activeId&&!document.hidden)ccScheduleWatchdogReconnect(150);
  }));
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&activeId)ccScheduleWatchdogReconnect(180);
  });
  ccStartWatchdog();
}catch(e){console.warn('CamCam viewer WebRTC lifecycle',e)}

// ---- Push-to-talk lifecycle --------------------------------------------------
let ccTalkHeld=false;
let ccTalkBusy=false;
let ccTalkGeneration=0;
let ccTalkAbort=null;
let ccRemoteAudioState=null;

function ccSetNote(message,ok){
  const n=document.getElementById('controlNote');
  if(!n)return;
  n.textContent=message||'';
  n.classList.remove('cc-ok','cc-bad');
  if(ok===true)n.classList.add('cc-ok');
  if(ok===false)n.classList.add('cc-bad');
}

function ccPauseRemoteAudio(){
  const live=document.getElementById('liveVideo');
  if(!live)return;
  const tracks=live.srcObject?.getAudioTracks?.()||[];
  ccRemoteAudioState={muted:live.muted,volume:live.volume,tracks:tracks.map(t=>({track:t,enabled:t.enabled}))};
  try{live.muted=true;live.volume=0}catch{}
  for(const item of ccRemoteAudioState.tracks){try{item.track.enabled=false}catch{}}
}

function ccRestoreRemoteAudio(){
  const live=document.getElementById('liveVideo');
  const state=ccRemoteAudioState;ccRemoteAudioState=null;
  if(!live||!state)return;
  for(const item of state.tracks||[]){try{item.track.enabled=item.enabled}catch{}}
  try{live.muted=state.muted;live.volume=state.volume}catch{}
}

async function ccNativeMicPermission(){
  try{
    if(!window.CamCamNative?.hasMicrophonePermission)return true;
    if(window.CamCamNative.hasMicrophonePermission())return true;
    return await new Promise(resolve=>{
      let done=false;
      const finish=v=>{if(done)return;done=true;resolve(!!v)};
      window.addEventListener('camcam-native-mic',e=>finish(e.detail?.granted),{once:true});
      window.CamCamNative.requestMicrophonePermission();
      setTimeout(()=>finish(window.CamCamNative?.hasMicrophonePermission?.()),8000);
    });
  }catch{return true}
}

function ccNativePrepare(){try{return window.CamCamNative?.prepareMicrophone?.()!==false}catch{return false}}
function ccNativeRelease(){try{window.CamCamNative?.releaseMicrophone?.()}catch{}}

async function ccTryMic(configs){
  let last=null;
  for(const cfg of configs){
    try{
      const stream=await navigator.mediaDevices.getUserMedia(cfg);
      const track=stream?.getAudioTracks?.()[0];
      if(track&&track.readyState==='live')return stream;
      try{stream?.getTracks?.().forEach(t=>t.stop())}catch{}
    }catch(e){last=e}
    await ccWait(120);
  }
  throw last||new Error('Audio capture did not start');
}

async function ccAcquireMic(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('دسترسی میکروفن در WebView موجود نیست');
  ccNativeRelease();
  await ccWait(120);
  ccNativePrepare();
  await ccWait(160);

  let last=null;
  try{
    return await ccTryMic([
      {audio:true,video:false},
      {audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false},
      {audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}
    ]);
  }catch(e){last=e}

  let inputs=[];
  try{inputs=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput')}catch{}
  for(const input of inputs){
    try{
      return await ccTryMic([
        {audio:{deviceId:{exact:input.deviceId}},video:false},
        {audio:{deviceId:{exact:input.deviceId},echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false}
      ]);
    }catch(e){last=e}
  }

  ccNativeRelease();
  await ccWait(450);
  ccNativePrepare();
  await ccWait(300);
  try{return await ccTryMic([{audio:true,video:false}])}catch(e){last=e}

  const name=String(last?.name||'');
  const msg=String(last?.message||last||'');
  if(name==='NotAllowedError'||name==='SecurityError')throw new Error('اجازه میکروفن برای CamCam فعال نیست');
  if(name==='NotReadableError'||/audio source|could not start/i.test(msg))throw new Error('منبع صوتی اندروید باز نشد');
  throw last||new Error('میکروفن شروع نشد');
}

async function ccStartTalk(e){
  if(!activeId||activeDevice?.access==='viewer'||talkPC||ccTalkBusy)return;
  e?.preventDefault();
  ccTalkHeld=true;
  ccTalkBusy=true;
  const generation=++ccTalkGeneration;
  const deviceId=activeId;
  const b=document.getElementById('talk');
  if(b){b.classList.add('active');b.textContent='در حال آماده‌سازی میکروفن…'}
  const ensureHeld=()=>{
    if(!ccTalkHeld||generation!==ccTalkGeneration||activeId!==deviceId)throw ccCancelled();
  };

  try{
    if(!await ccNativeMicPermission())throw new Error('اجازه میکروفن داده نشد');
    ensureHeld();
    ccPauseRemoteAudio();
    talkStream=await ccAcquireMic();
    ensureHeld();

    await api(`/api/pet/devices/${deviceId}/talk-wake`,{method:'POST'}).catch(()=>{});
    ensureHeld();
    const auth=await api(`/api/pet/devices/${deviceId}/talk-token`,{method:'POST'});
    ensureHeld();

    const p=newPeer();
    talkPC=p;
    talkStream.getAudioTracks().forEach(t=>p.addTrack(t,talkStream));
    const offer=await p.createOffer();
    ensureHeld();
    await p.setLocalDescription(offer);
    await waitIce(p);
    ensureHeld();

    const controller=new AbortController();
    ccTalkAbort=controller;
    const timeout=setTimeout(()=>controller.abort(),15000);
    let r;
    try{
      r=await fetch(auth.whip_url,{
        method:'POST',
        headers:{'Content-Type':'application/sdp','Authorization':'Bearer '+auth.token},
        body:p.localDescription.sdp,
        signal:controller.signal
      });
    }finally{
      clearTimeout(timeout);
      if(ccTalkAbort===controller)ccTalkAbort=null;
    }
    ensureHeld();
    if(!r.ok)throw new Error('مسیر صحبت برقرار نشد ('+r.status+')');
    talkResource=r.headers.get('Location');

    // Important: read the SDP first, then check whether pointer-up cancelled
    // this generation. Previously pointer-up could close p during r.text(), and
    // setRemoteDescription() then threw signalingState=closed.
    const answer=await r.text();
    ensureHeld();
    if(p.signalingState==='closed')throw ccCancelled();
    await p.setRemoteDescription({type:'answer',sdp:answer});
    ensureHeld();
    if(b)b.textContent='🎙 در حال صحبت…';
  }catch(err){
    const cancelled=err?.ccCancelled||err?.name==='AbortError'||
      (err?.name==='InvalidStateError'&&talkPC?.signalingState==='closed');
    if(!cancelled){
      const raw=String(err?.message||err||'خطای نامشخص');
      const msg=/audio source|منبع صوتی اندروید/i.test(raw)
        ? 'میکروفن اندروید باز نشد؛ نسخه جدید اپ مجوز صوتی WebRTC را اصلاح می‌کند.'
        : 'میکروفن شروع نشد: '+raw;
      toast(msg);
    }
    await ccStopTalk();
  }finally{ccTalkBusy=false}
}

async function ccStopTalk(){
  ccTalkHeld=false;
  ccTalkGeneration++;
  try{ccTalkAbort?.abort()}catch{}
  ccTalkAbort=null;
  const b=document.getElementById('talk');
  if(b){b.classList.remove('active');b.textContent='🎙 نگه دار و صحبت کن'}
  try{talkStream?.getTracks?.().forEach(t=>t.stop())}catch{}
  talkStream=null;
  try{talkPC?.close()}catch{}
  talkPC=null;
  if(talkResource){try{await fetch(talkResource,{method:'DELETE'})}catch{}talkResource=null}
  ccNativeRelease();
  ccRestoreRemoteAudio();
  ccTalkBusy=false;
}

const oldTalk=document.getElementById('talk');
if(oldTalk){
  const fresh=oldTalk.cloneNode(true);
  oldTalk.parentNode.replaceChild(fresh,oldTalk);
  fresh.addEventListener('pointerdown',ccStartTalk,{passive:false});
  ['pointerup','pointercancel','pointerleave','lostpointercapture'].forEach(name=>fresh.addEventListener(name,ccStopTalk,{passive:true}));
}
try{startTalk=ccStartTalk;stopTalk=ccStopTalk}catch{}

// ---- Command channel ---------------------------------------------------------
async function ccCommand(type,value){
  if(!activeId)return {ok:false,message:'دوربینی انتخاب نشده است.'};
  ccSetNote('فرمان ارسال شد؛ منتظر گوشی دوربین…');
  let commandId=null;
  try{
    const d=await api(`/api/pet/devices/${activeId}/command`,{method:'POST',body:JSON.stringify({type,value})});
    commandId=d?.command?.id;
    if(!commandId)throw new Error('شناسه فرمان دریافت نشد');
  }catch(e){ccSetNote(e.message,false);return {ok:false,message:e.message}}

  const deadline=Date.now()+12000;
  while(Date.now()<deadline&&activeId){
    try{
      const rows=await api(`/api/pet/devices/${activeId}/events`);
      const ack=(rows||[]).find(x=>x.kind==='control_ack'&&String(x.metadata?.command_id||'')===String(commandId));
      if(ack?.metadata){
        const result=ack.metadata;
        ccSetNote(result.message||'فرمان اجرا شد.',result.ok!==false);
        return result;
      }
    }catch{}
    await ccWait(350);
  }
  const msg='گوشی دوربین آنلاین است اما کانال کنترل هنوز پاسخ نداده؛ در حال بازیابی اتصال است.';
  ccSetNote(msg,null);
  return {ok:null,pending:true,message:msg};
}

try{
  cmd=async function(type,value,quiet=false){const r=await ccCommand(type,value);if(!quiet)toast(r.message);return r};
  toggleTorch=async function(){
    const b=document.getElementById('torch');if(b?.disabled)return;
    const before=!!control.torch,want=!before;if(b)b.disabled=true;
    const r=await ccCommand('torch',want);
    if(r.ok===true)control.torch=want;else if(r.ok===false)control.torch=before;
    try{renderControl()}catch{};if(b)b.disabled=false;toast(r.message);
    setTimeout(()=>activeId&&loadHealth(),600);
  };
  toggleLowPower=async function(){
    const b=document.getElementById('lowPower');if(b?.disabled)return;
    const before=!!control.low,want=!before;if(b)b.disabled=true;
    const r=await ccCommand('low_power',want);
    if(r.ok===true)control.low=want;else if(r.ok===false)control.low=before;
    try{renderControl()}catch{};if(b)b.disabled=false;toast(r.message);
    setTimeout(()=>activeId&&loadHealth(),600);
  };
}catch(e){console.warn('CamCam runtime v2 command layer',e)}

window.__camcamViewerRuntimeV2=true;
window.__camcamViewerNegotiationGuardV1=true;
document.documentElement.dataset.camcamViewerRuntime='14-negotiation-guard';
})();
