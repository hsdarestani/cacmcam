(function(){
'use strict';

const ccWait=ms=>new Promise(r=>setTimeout(r,ms));
let ccTalkHeld=false;
let ccTalkBusy=false;
let ccTalkGeneration=0;
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

  // Prepare Android audio routing before Chromium opens AudioRecord. This is
  // important on Xiaomi/MIUI and several Android 13+ WebView builds.
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

  // Explicit input selection fixes devices whose default Android audio source
  // is unavailable even though RECORD_AUDIO permission has been granted.
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

  // One full Android audio-route reset before declaring failure.
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
  const b=document.getElementById('talk');
  if(b){b.classList.add('active');b.textContent='در حال آماده‌سازی میکروفن…'}
  const ensureHeld=()=>{if(!ccTalkHeld||generation!==ccTalkGeneration){const x=new Error('cancelled');x.ccCancelled=true;throw x}};

  try{
    if(!await ccNativeMicPermission())throw new Error('اجازه میکروفن داده نشد');
    ensureHeld();
    ccPauseRemoteAudio();
    talkStream=await ccAcquireMic();
    ensureHeld();

    await api(`/api/pet/devices/${activeId}/talk-wake`,{method:'POST'}).catch(()=>{});
    ensureHeld();
    const auth=await api(`/api/pet/devices/${activeId}/talk-token`,{method:'POST'});
    ensureHeld();

    const p=newPeer();talkPC=p;
    talkStream.getAudioTracks().forEach(t=>p.addTrack(t,talkStream));
    const offer=await p.createOffer();
    await p.setLocalDescription(offer);
    await waitIce(p);
    ensureHeld();

    const r=await fetch(auth.whip_url,{method:'POST',headers:{'Content-Type':'application/sdp','Authorization':'Bearer '+auth.token},body:p.localDescription.sdp});
    if(!r.ok)throw new Error('مسیر صحبت برقرار نشد ('+r.status+')');
    talkResource=r.headers.get('Location');
    await p.setRemoteDescription({type:'answer',sdp:await r.text()});
    ensureHeld();
    if(b)b.textContent='🎙 در حال صحبت…';
  }catch(err){
    if(!err?.ccCancelled){
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

// Remove all older pointer listeners by replacing the button once more.
const oldTalk=document.getElementById('talk');
if(oldTalk){
  const fresh=oldTalk.cloneNode(true);
  oldTalk.parentNode.replaceChild(fresh,oldTalk);
  fresh.addEventListener('pointerdown',ccStartTalk,{passive:false});
  ['pointerup','pointercancel','pointerleave','lostpointercapture'].forEach(name=>fresh.addEventListener(name,ccStopTalk,{passive:true}));
}
try{startTalk=ccStartTalk;stopTalk=ccStopTalk}catch{}

// Final command layer: once the camera control-plane fix is installed, ACKs
// arrive independently of whether the video stream itself is currently up.
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
})();
