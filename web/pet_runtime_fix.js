(function(){
'use strict';

const nap=ms=>new Promise(r=>setTimeout(r,ms));
const pending={torch:null,torchUntil:0,low:null,lowUntil:0};
let talkBusy=false,talkHeld=false,talkGeneration=0,viewerWasMuted=null,manualBusy=false;

function note(msg,kind){
  const n=document.getElementById('controlNote');if(!n)return;
  n.textContent=msg||'';n.classList.remove('cc-ok','cc-bad');
  if(kind===true)n.classList.add('cc-ok');else if(kind===false)n.classList.add('cc-bad');
}

function applyTelemetryTruth(t,force=false){
  if(!t)return;
  const now=Date.now();
  if(t.torch!=null){
    const v=!!t.torch;
    if(force||pending.torch===null||v===pending.torch||now>pending.torchUntil){control.torch=v;if(v===pending.torch||now>pending.torchUntil)pending.torch=null;}
  }
  if(t.low_power!=null){
    const v=!!t.low_power;
    if(force||pending.low===null||v===pending.low||now>pending.lowUntil){control.low=v;if(v===pending.low||now>pending.lowUntil)pending.low=null;}
  }
  if(t.zoom!=null)control.zoom=Math.max(1,Number(t.zoom)||1);
  if(t.quality){control.quality=t.quality;const q=document.getElementById('quality');if(q)q.value=t.quality;}
  if(activeDevice)activeDevice.telemetry={...(activeDevice.telemetry||{}),...t};
  try{renderControl()}catch{}
}

function stateMatches(type,value,t,beforeFacing){
  if(!t)return false;
  if(type==='torch'&&t.torch!=null)return !!t.torch===!!value;
  if(type==='low_power'&&t.low_power!=null)return !!t.low_power===!!value;
  if(type==='zoom'&&t.zoom!=null)return Math.abs(Number(t.zoom)-Number(value))<0.16;
  if(type==='quality'&&t.quality)return String(t.quality)===String(value);
  if(type==='camera'&&t.facing&&beforeFacing)return String(t.facing)!==String(beforeFacing);
  return false;
}

function confirmedMessage(type,value){
  if(type==='torch')return value?'چراغ روشن شد.':'چراغ خاموش شد.';
  if(type==='low_power')return value?'حالت کم‌مصرف فعال شد.':'حالت کم‌مصرف خاموش شد.';
  if(type==='zoom')return 'زوم روی '+Number(value).toFixed(1)+'× اعمال شد.';
  if(type==='camera')return 'دوربین تغییر کرد.';
  if(type==='quality')return 'کیفیت '+String(value)+' اعمال شد.';
  return 'فرمان روی دوربین اجرا شد.';
}

async function fetchHealthQuiet(){
  if(!activeId)return null;
  try{return await api(`/api/pet/devices/${activeId}/health`)}catch{return null}
}

async function waitCommandTruth(commandId,type,value,beforeFacing,timeout=11000){
  const end=Date.now()+timeout;
  while(Date.now()<end&&activeId){
    const [eventsRes,healthRes]=await Promise.allSettled([
      api(`/api/pet/devices/${activeId}/events`),
      api(`/api/pet/devices/${activeId}/health`)
    ]);
    if(eventsRes.status==='fulfilled'){
      const rows=eventsRes.value||[];
      const ack=rows.find(e=>e.kind==='control_ack'&&String(e.metadata?.command_id||'')===String(commandId||''));
      if(ack?.metadata)return ack.metadata;
    }
    if(healthRes.status==='fulfilled'){
      const h=healthRes.value||{},t=h.telemetry||{};
      applyTelemetryTruth(t,false);
      if(stateMatches(type,value,t,beforeFacing))return {ok:true,message:confirmedMessage(type,value),confirmed_by:'telemetry'};
    }
    await nap(420);
  }
  return null;
}

try{
  syncControl=function(){
    const t=activeDevice?.telemetry||{},p=activeDevice?.pet||{};
    if(!t.quality&&p.quality)t.quality=p.quality;
    applyTelemetryTruth(t,true);
  };

  loadHealth=async function(){
    if(!activeId)return;
    try{
      const h=await api(`/api/pet/devices/${activeId}/health`),t=h.telemetry||{};
      applyTelemetryTruth(t,false);
      const a=[h.online?'● آنلاین':'● آفلاین',h.recording?'آرشیو فعال':'آرشیو در انتظار داده'];
      if(t.quality)a.push(t.quality);if(t.battery!=null)a.push('باتری '+t.battery+'٪');
      if(t.torch)a.push('چراغ روشن');if(t.low_power)a.push('کم‌مصرف');if(t.talk_connected)a.push('صدای دوطرفه متصل');
      const box=document.getElementById('health');if(box)box.textContent=a.join(' · ');
    }catch(e){const box=document.getElementById('health');if(box)box.textContent=e.message}
  };

  cmd=async function(type,value,quiet=false){
    if(!activeId)return null;
    const beforeFacing=activeDevice?.telemetry?.facing||null;
    try{
      note('فرمان ارسال شد؛ منتظر تأیید واقعی دوربین…');
      const d=await api(`/api/pet/devices/${activeId}/command`,{method:'POST',body:JSON.stringify({type,value})});
      const id=d?.command?.id;
      if(!id)throw new Error('شناسه فرمان از سرور دریافت نشد');
      const result=await waitCommandTruth(id,type,value,beforeFacing);
      if(result){note(result.message||'فرمان اجرا شد.',result.ok!==false);if(!quiet)toast(result.message||'فرمان اجرا شد.');return result;}
      const msg='فرمان ارسال شد؛ وضعیت دوربین در حال همگام‌سازی است.';
      note(msg,null);if(!quiet)toast(msg);
      setTimeout(()=>activeId&&loadHealth(),900);
      setTimeout(()=>activeId&&loadHealth(),2600);
      return {ok:null,message:msg,pending:true};
    }catch(e){note(e.message,false);if(!quiet)toast(e.message);return {ok:false,message:e.message};}
  };

  toggleTorch=async function(){
    const b=document.getElementById('torch');if(b?.disabled)return;
    const before=!!control.torch,want=!before;pending.torch=want;pending.torchUntil=Date.now()+12000;control.torch=want;renderControl();if(b)b.disabled=true;
    const a=await cmd('torch',want,true);
    if(a?.ok===false){pending.torch=null;control.torch=before;renderControl();toast(a.message||'چراغ تغییر نکرد');}
    else toast(a?.message||confirmedMessage('torch',want));
    if(b)b.disabled=false;
    [300,900,1900,4200,8000].forEach(ms=>setTimeout(()=>activeId&&loadHealth(),ms));
  };

  toggleLowPower=async function(){
    const b=document.getElementById('lowPower');if(b?.disabled)return;
    const before=!!control.low,want=!before;pending.low=want;pending.lowUntil=Date.now()+12000;control.low=want;renderControl();if(b)b.disabled=true;
    const a=await cmd('low_power',want,true);
    if(a?.ok===false){pending.low=null;control.low=before;renderControl();toast(a.message||'حالت کم‌مصرف تغییر نکرد');}
    else toast(a?.message||confirmedMessage('low_power',want));
    if(b)b.disabled=false;
    [300,900,1900,4200,8000].forEach(ms=>setTimeout(()=>activeId&&loadHealth(),ms));
  };

  rotateCamera=async function(b){
    if(b)b.disabled=true;
    const a=await cmd('camera','switch',true);
    if(b)b.disabled=false;
    toast(a?.message||'فرمان تغییر دوربین ارسال شد.');
    if(a?.ok!==false)setTimeout(()=>activeId&&openLive(activeId),900);
  };

  commitZoom=async function(v){
    const wanted=Number(v);const a=await cmd('zoom',wanted,true);
    if(a?.applied_zoom!=null)control.zoom=Number(a.applied_zoom);
    else if(a?.ok!==false)control.zoom=wanted;
    renderControl();toast(a?.message||'زوم در حال همگام‌سازی است.');
  };
}catch(e){console.warn('CamCam command reliability',e)}

async function nativeMicPermission(){
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
function nativeMicPrepare(){try{return window.CamCamNative?.prepareMicrophone?.()!==false}catch{return true}}
function nativeMicRelease(){try{window.CamCamNative?.releaseMicrophone?.()}catch{}}

async function acquireMicOnce(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('دسترسی میکروفن در WebView موجود نیست');
  let last=null;
  const attempts=[
    {audio:true,video:false},
    {audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false},
    {audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false}
  ];
  for(const cfg of attempts){try{return await navigator.mediaDevices.getUserMedia(cfg)}catch(e){last=e;await nap(250)}}
  throw last||new Error('میکروفن شروع نشد');
}

async function acquireMicRobust(){
  nativeMicRelease();await nap(180);
  let last=null;
  try{return await acquireMicOnce()}catch(e){last=e;}
  nativeMicRelease();await nap(450);nativeMicPrepare();await nap(350);
  try{return await acquireMicOnce()}catch(e){last=e;}
  nativeMicRelease();await nap(650);
  try{return await acquireMicOnce()}catch(e){last=e;}
  const n=last?.name||'',m=String(last?.message||'');
  if(n==='NotAllowedError'||n==='SecurityError')throw new Error('اجازه میکروفن برای CamCam فعال نیست');
  if(n==='NotReadableError'||m.toLowerCase().includes('audio source'))throw new Error('میکروفن باز نشد؛ یک برنامه دیگر از میکروفن استفاده می‌کند');
  throw last||new Error('میکروفن شروع نشد');
}

async function startTalkFixed(e){
  if(!activeId||activeDevice?.access==='viewer'||talkPC||talkBusy)return;
  e?.preventDefault();talkHeld=true;const gen=++talkGeneration;talkBusy=true;
  const b=document.getElementById('talk');if(b){b.classList.add('active');b.textContent='در حال آماده‌سازی میکروفن…'}
  const ensureHeld=()=>{if(!talkHeld||gen!==talkGeneration){const x=new Error('cancelled');x.camcamCancelled=true;throw x;}};
  try{
    if(!await nativeMicPermission())throw new Error('اجازه میکروفن داده نشد');ensureHeld();
    const live=document.getElementById('liveVideo');if(live){viewerWasMuted=live.muted;live.muted=true;}
    talkStream=await acquireMicRobust();ensureHeld();
    nativeMicPrepare();await nap(120);ensureHeld();
    await api(`/api/pet/devices/${activeId}/talk-wake`,{method:'POST'}).catch(()=>{});ensureHeld();
    const auth=await api(`/api/pet/devices/${activeId}/talk-token`,{method:'POST'});ensureHeld();
    const p=newPeer();talkPC=p;talkStream.getAudioTracks().forEach(t=>p.addTrack(t,talkStream));
    const offer=await p.createOffer();await p.setLocalDescription(offer);await waitIce(p);ensureHeld();
    const r=await fetch(auth.whip_url,{method:'POST',headers:{'Content-Type':'application/sdp','Authorization':'Bearer '+auth.token},body:p.localDescription.sdp});
    if(!r.ok)throw new Error('مسیر صحبت برقرار نشد ('+r.status+')');ensureHeld();
    talkResource=r.headers.get('Location');await p.setRemoteDescription({type:'answer',sdp:await r.text()});ensureHeld();
    if(b)b.textContent='🎙 در حال صحبت…';
  }catch(err){
    if(!err?.camcamCancelled)toast('میکروفن شروع نشد: '+(err?.message||'خطای نامشخص'));
    await stopTalkFixed();
  }finally{talkBusy=false}
}

async function stopTalkFixed(){
  talkHeld=false;talkGeneration++;
  const b=document.getElementById('talk');if(b){b.classList.remove('active');b.textContent='🎙 نگه دار و صحبت کن'}
  if(talkStream)try{talkStream.getTracks().forEach(t=>t.stop())}catch{}talkStream=null;
  if(talkPC)try{talkPC.close()}catch{}talkPC=null;
  if(talkResource){try{await fetch(talkResource,{method:'DELETE'})}catch{}talkResource=null;}
  nativeMicRelease();
  const live=document.getElementById('liveVideo');if(live&&viewerWasMuted!==null)live.muted=viewerWasMuted;viewerWasMuted=null;
  talkBusy=false;
}

const oldTalk=document.getElementById('talk');
if(oldTalk){
  const fresh=oldTalk.cloneNode(true);oldTalk.parentNode.replaceChild(fresh,oldTalk);
  fresh.addEventListener('pointerdown',startTalkFixed,{passive:false});
  ['pointerup','pointercancel','pointerleave','lostpointercapture'].forEach(ev=>fresh.addEventListener(ev,stopTalkFixed,{passive:true}));
}
try{startTalk=startTalkFixed;stopTalk=stopTalkFixed}catch{}

try{
  toggleManual=async function(){
    if(!activeId||manualBusy)return;
    const b=document.getElementById('manual');manualBusy=true;if(b)b.disabled=true;
    try{
      if(!manualActive){
        const h=await fetchHealthQuiet();
        if(h&&h.online===false)throw new Error('دوربین آفلاین است؛ ضبط دستی شروع نشد.');
        note('در حال شروع ضبط دستی…');
        manualActive=await api(`/api/pet/devices/${activeId}/manual-recordings/start`,{method:'POST'});
        clearInterval(manualTimer);manualTimer=setInterval(()=>{try{renderManual()}catch{}},1000);renderManual();
        note('ضبط دستی فعال است.',true);toast('ضبط دستی شروع شد');
      }else{
        note('در حال پایان و آماده‌سازی کلیپ…');
        const finished=await api(`/api/pet/devices/${activeId}/manual-recordings/${manualActive.id}/stop`,{method:'POST'});
        manualActive=null;clearInterval(manualTimer);manualTimer=null;renderManual();
        await nap(700);await loadManual();
        note(finished?.url?'کلیپ دستی ذخیره شد و در آرشیو آماده است.':'ضبط پایان یافت؛ کلیپ در حال آماده‌سازی است.',true);
        toast('کلیپ دستی ذخیره شد');
      }
    }catch(e){note(e.message,false);toast(e.message)}
    finally{manualBusy=false;if(b)b.disabled=false}
  };
}catch(e){console.warn('CamCam manual recording fix',e)}

let healthPulse=setInterval(()=>{try{if(activeId)loadHealth()}catch{}},5000);
window.addEventListener('pagehide',()=>{clearInterval(healthPulse);try{stopTalkFixed()}catch{}});
setTimeout(()=>{try{if(activeId)loadHealth()}catch{}},250);
})();