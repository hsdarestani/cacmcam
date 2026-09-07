(function(){
'use strict';

const v3Wait=ms=>new Promise(r=>setTimeout(r,ms));
let v3TalkHeld=false,v3TalkBusy=false,v3TalkGeneration=0,v3RemoteAudioState=null;

function v3Note(message,ok){
  const n=document.getElementById('controlNote');if(!n)return;
  n.textContent=message||'';n.classList.remove('cc-ok','cc-bad');
  if(ok===true)n.classList.add('cc-ok');else if(ok===false)n.classList.add('cc-bad');
}

function v3ApplyTelemetry(t){
  if(!t)return;
  if(activeDevice)activeDevice.telemetry={...(activeDevice.telemetry||{}),...t};
  if(t.torch!=null)control.torch=!!t.torch;
  if(t.low_power!=null)control.low=!!t.low_power;
  if(t.zoom!=null)control.zoom=Math.max(1,Number(t.zoom)||1);
  if(t.quality){control.quality=t.quality;const q=document.getElementById('quality');if(q)q.value=t.quality;}
  try{renderControl()}catch{}
}

function v3StateMatches(type,value,t,beforeFacing){
  if(!t)return false;
  if(type==='torch'&&t.torch!=null)return !!t.torch===!!value;
  if(type==='low_power'&&t.low_power!=null)return !!t.low_power===!!value;
  if(type==='zoom'&&t.zoom!=null)return Math.abs(Number(t.zoom)-Number(value))<0.16;
  if(type==='quality'&&t.quality)return String(t.quality)===String(value);
  if(type==='camera'&&t.facing&&beforeFacing)return String(t.facing)!==String(beforeFacing);
  return false;
}

function v3ConfirmedMessage(type,value){
  if(type==='torch')return value?'چراغ روشن شد.':'چراغ خاموش شد.';
  if(type==='low_power')return value?'حالت کم‌مصرف فعال شد.':'حالت کم‌مصرف خاموش شد.';
  if(type==='zoom')return 'زوم روی '+Number(value).toFixed(1)+'× اعمال شد.';
  if(type==='camera')return 'دوربین تغییر کرد.';
  if(type==='quality')return 'کیفیت '+String(value)+' اعمال شد.';
  return 'فرمان روی دوربین اجرا شد.';
}

async function v3Command(type,value){
  const deviceId=activeId;
  if(!deviceId)return {ok:false,message:'دوربینی انتخاب نشده است.'};
  const beforeFacing=activeDevice?.telemetry?.facing||null;
  v3Note('فرمان ارسال شد؛ منتظر تأیید واقعی گوشی دوربین…');
  let commandId=null;
  try{
    const d=await api(`/api/pet/devices/${deviceId}/command`,{method:'POST',body:JSON.stringify({type,value})});
    commandId=d?.command?.id;
    if(!commandId)throw new Error('شناسه فرمان دریافت نشد');
  }catch(e){v3Note(e.message,false);return {ok:false,message:e.message};}

  const deadline=Date.now()+12000;
  while(Date.now()<deadline&&activeId===deviceId){
    const [eventsResult,healthResult]=await Promise.allSettled([
      api(`/api/pet/devices/${deviceId}/events`),
      api(`/api/pet/devices/${deviceId}/health`)
    ]);

    if(eventsResult.status==='fulfilled'){
      const ack=(eventsResult.value||[]).find(x=>x.kind==='control_ack'&&String(x.metadata?.command_id||'')===String(commandId));
      if(ack?.metadata){
        const result=ack.metadata;
        if(result.applied_zoom!=null)control.zoom=Number(result.applied_zoom)||control.zoom;
        try{renderControl()}catch{}
        v3Note(result.message||'فرمان اجرا شد.',result.ok!==false);
        return result;
      }
    }

    if(healthResult.status==='fulfilled'){
      const telemetry=healthResult.value?.telemetry||{};
      v3ApplyTelemetry(telemetry);
      if(v3StateMatches(type,value,telemetry,beforeFacing)){
        const result={ok:true,message:v3ConfirmedMessage(type,value),confirmed_by:'telemetry'};
        v3Note(result.message,true);
        return result;
      }
    }
    await v3Wait(350);
  }

  const msg='فرمان اجرا/ارسال شد اما ACK مستقیم نرسید؛ وضعیت واقعی دوربین از telemetry همگام می‌شود.';
  v3Note(msg,null);
  setTimeout(()=>activeId===deviceId&&loadHealth(),500);
  setTimeout(()=>activeId===deviceId&&loadHealth(),1800);
  return {ok:null,pending:true,message:msg};
}

try{
  cmd=async function(type,value,quiet=false){const r=await v3Command(type,value);if(!quiet)toast(r.message);return r;};
  toggleTorch=async function(){
    const b=document.getElementById('torch');if(b?.disabled)return;
    const before=!!control.torch,want=!before;b.disabled=true;
    const r=await v3Command('torch',want);
    if(r.ok===true)control.torch=want;else if(r.ok===false)control.torch=before;
    try{renderControl()}catch{};b.disabled=false;toast(r.message);setTimeout(()=>activeId&&loadHealth(),500);
  };
  toggleLowPower=async function(){
    const b=document.getElementById('lowPower');if(b?.disabled)return;
    const before=!!control.low,want=!before;b.disabled=true;
    const r=await v3Command('low_power',want);
    if(r.ok===true)control.low=want;else if(r.ok===false)control.low=before;
    try{renderControl()}catch{};b.disabled=false;toast(r.message);setTimeout(()=>activeId&&loadHealth(),500);
  };
  rotateCamera=async function(b){if(b)b.disabled=true;const r=await v3Command('camera','switch');if(b)b.disabled=false;toast(r.message);if(r.ok!==false)setTimeout(()=>activeId&&openLive(activeId),700);};
  commitZoom=async function(v){const wanted=Number(v),r=await v3Command('zoom',wanted);if(r.applied_zoom!=null)control.zoom=Number(r.applied_zoom);else if(r.ok!==false)control.zoom=wanted;try{renderControl()}catch{};toast(r.message);};
  phrase=async function(text,b){if(b)b.disabled=true;const r=await v3Command('say',text);if(b)b.disabled=false;toast(r.message);};
}catch(e){console.warn('CamCam viewer command v3',e);}

function v3PauseRemoteAudio(){
  const live=document.getElementById('liveVideo');if(!live)return;
  const tracks=live.srcObject?.getAudioTracks?.()||[];
  v3RemoteAudioState={muted:live.muted,volume:live.volume,tracks:tracks.map(track=>({track,enabled:track.enabled}))};
  try{live.muted=true;live.volume=0}catch{}
  for(const item of v3RemoteAudioState.tracks){try{item.track.enabled=false}catch{}}
}
function v3RestoreRemoteAudio(){
  const live=document.getElementById('liveVideo'),state=v3RemoteAudioState;v3RemoteAudioState=null;
  if(!live||!state)return;
  for(const item of state.tracks||[]){try{item.track.enabled=item.enabled}catch{}}
  try{live.muted=state.muted;live.volume=state.volume}catch{}
}
async function v3MicPermission(){
  try{
    if(!window.CamCamNative?.hasMicrophonePermission)return true;
    if(window.CamCamNative.hasMicrophonePermission())return true;
    return await new Promise(resolve=>{
      let done=false;const finish=v=>{if(done)return;done=true;resolve(!!v)};
      window.addEventListener('camcam-native-mic',e=>finish(e.detail?.granted),{once:true});
      window.CamCamNative.requestMicrophonePermission();
      setTimeout(()=>finish(window.CamCamNative?.hasMicrophonePermission?.()),7000);
    });
  }catch{return true;}
}
function v3NativePrepare(){try{return window.CamCamNative?.prepareMicrophone?.()!==false}catch{return true}}
function v3NativeRelease(){try{window.CamCamNative?.releaseMicrophone?.()}catch{}}
async function v3AcquireMic(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('دسترسی میکروفن در WebView موجود نیست');
  v3NativeRelease();await v3Wait(100);v3NativePrepare();await v3Wait(160);
  let last=null;
  const configs=[
    {audio:true,video:false},
    {audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false},
    {audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}
  ];
  for(const cfg of configs){
    try{const s=await navigator.mediaDevices.getUserMedia(cfg);if(s?.getAudioTracks?.()[0]?.readyState==='live')return s;try{s?.getTracks?.().forEach(t=>t.stop())}catch{}}
    catch(e){last=e}
    await v3Wait(180);
  }
  throw last||new Error('میکروفن شروع نشد');
}

async function v3StartTalk(e){
  if(!activeId||activeDevice?.access==='viewer'||talkPC||v3TalkBusy)return;
  e?.preventDefault();
  try{e?.currentTarget?.setPointerCapture?.(e.pointerId)}catch{}
  v3TalkHeld=true;v3TalkBusy=true;const generation=++v3TalkGeneration;
  const deviceId=activeId,b=document.getElementById('talk');if(b){b.classList.add('active');b.textContent='در حال آماده‌سازی میکروفن…'}
  const ensureHeld=()=>{if(!v3TalkHeld||generation!==v3TalkGeneration||activeId!==deviceId){const x=new Error('cancelled');x.v3Cancelled=true;throw x;}};
  try{
    if(!await v3MicPermission())throw new Error('اجازه میکروفن داده نشد');ensureHeld();
    v3PauseRemoteAudio();
    talkStream=await v3AcquireMic();ensureHeld();
    const auth=await api(`/api/pet/devices/${deviceId}/talk-token`,{method:'POST'});ensureHeld();
    const p=newPeer();talkPC=p;talkStream.getAudioTracks().forEach(t=>p.addTrack(t,talkStream));
    const offer=await p.createOffer();await p.setLocalDescription(offer);await waitIce(p);ensureHeld();
    const r=await fetch(auth.whip_url,{method:'POST',headers:{'Content-Type':'application/sdp','Authorization':'Bearer '+auth.token},body:p.localDescription.sdp});
    if(!r.ok)throw new Error('مسیر صحبت برقرار نشد ('+r.status+')');
    talkResource=r.headers.get('Location');await p.setRemoteDescription({type:'answer',sdp:await r.text()});ensureHeld();

    // Publish first, then wake the camera reader. The old order raced WHEP against
    // a talk path that did not have a publisher yet.
    const wake=()=>api(`/api/pet/devices/${deviceId}/talk-wake`,{method:'POST'}).catch(()=>{});
    await wake();setTimeout(()=>v3TalkHeld&&activeId===deviceId&&wake(),260);
    if(b)b.textContent='🎙 در حال صحبت…';
  }catch(err){
    if(!err?.v3Cancelled){const raw=String(err?.message||err||'خطای نامشخص');toast(/audio source|منبع صوتی|NotReadable/i.test(raw)?'میکروفن اندروید باز نشد؛ دسترسی Microphone و نسخه جدید اپ را بررسی کن.':'Push-to-talk برقرار نشد: '+raw);}
    await v3StopTalk();
  }finally{v3TalkBusy=false;}
}

async function v3StopTalk(){
  v3TalkHeld=false;v3TalkGeneration++;
  const b=document.getElementById('talk');if(b){b.classList.remove('active');b.textContent='🎙 نگه دار و صحبت کن';}
  try{talkStream?.getTracks?.().forEach(t=>t.stop())}catch{}talkStream=null;
  try{talkPC?.close()}catch{}talkPC=null;
  if(talkResource){try{await fetch(talkResource,{method:'DELETE'})}catch{}talkResource=null;}
  v3NativeRelease();v3RestoreRemoteAudio();v3TalkBusy=false;
}

const oldTalk=document.getElementById('talk');
if(oldTalk){
  const fresh=oldTalk.cloneNode(true);oldTalk.parentNode.replaceChild(fresh,oldTalk);
  fresh.addEventListener('pointerdown',v3StartTalk,{passive:false});
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>fresh.addEventListener(name,v3StopTalk,{passive:true}));
}
try{startTalk=v3StartTalk;stopTalk=v3StopTalk}catch{}

window.__camcamViewerRuntimeV3=true;
})();
