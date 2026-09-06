(function(){
'use strict';
const nap=ms=>new Promise(r=>setTimeout(r,ms));
const pending={torch:null,torchUntil:0,low:null,lowUntil:0};
let talkBusy=false,viewerWasMuted=null;

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
  try{renderControl()}catch{}
}

try{
  syncControl=function(){const t=activeDevice?.telemetry||{},p=activeDevice?.pet||{};if(!t.quality&&p.quality)t.quality=p.quality;applyTelemetryTruth(t,true)};
  loadHealth=async function(){
    if(!activeId)return;
    try{
      const h=await api(`/api/pet/devices/${activeId}/health`),t=h.telemetry||{};
      if(activeDevice)activeDevice.telemetry={...(activeDevice.telemetry||{}),...t};
      applyTelemetryTruth(t,false);
      const a=[h.online?'● آنلاین':'آفلاین',h.recording?'ضبط فعال':'ضبط اخیر دیده نشد'];
      if(t.quality)a.push('کیفیت '+t.quality);if(t.battery!=null)a.push('باتری '+t.battery+'٪');
      if(t.torch)a.push('چراغ روشن');if(t.low_power)a.push('کم‌مصرف فعال');
      const box=document.getElementById('health');if(box)box.textContent=a.join(' · ');
    }catch(e){const box=document.getElementById('health');if(box)box.textContent=e.message}
  };

  toggleTorch=async function(){
    const b=document.getElementById('torch');if(b?.disabled)return;
    const before=!!control.torch,want=!before;pending.torch=want;pending.torchUntil=Date.now()+6500;control.torch=want;renderControl();if(b)b.disabled=true;
    const a=await cmd('torch',want,true);
    if(!a?.ok){pending.torch=null;control.torch=before;renderControl();toast(a?.message||'چراغ تغییر نکرد');}
    else toast(a.message|| (want?'چراغ روشن شد':'چراغ خاموش شد'));
    if(b)b.disabled=false;
    [350,900,1800,3500].forEach(ms=>setTimeout(()=>activeId&&loadHealth(),ms));
  };

  toggleLowPower=async function(){
    const b=document.getElementById('lowPower');if(b?.disabled)return;
    const before=!!control.low,want=!before;pending.low=want;pending.lowUntil=Date.now()+6500;control.low=want;renderControl();if(b)b.disabled=true;
    const a=await cmd('low_power',want,true);
    if(!a?.ok){pending.low=null;control.low=before;renderControl();toast(a?.message||'حالت کم‌مصرف تغییر نکرد');}
    else toast(a.message|| (want?'حالت کم‌مصرف روشن شد':'حالت کم‌مصرف خاموش شد'));
    if(b)b.disabled=false;
    [350,900,1800,3500].forEach(ms=>setTimeout(()=>activeId&&loadHealth(),ms));
  };
}catch(e){console.warn('CamCam control truth fix',e)}

async function nativeMicPermission(){
  try{
    if(!window.CamCamNative?.hasMicrophonePermission)return true;
    if(window.CamCamNative.hasMicrophonePermission())return true;
    return await new Promise(resolve=>{
      let done=false;
      const finish=v=>{if(done)return;done=true;resolve(!!v)};
      const listener=e=>finish(e.detail?.granted);
      window.addEventListener('camcam-native-mic',listener,{once:true});
      window.CamCamNative.requestMicrophonePermission();
      setTimeout(()=>finish(window.CamCamNative?.hasMicrophonePermission?.()),8000);
    });
  }catch{return true}
}

function nativeMicPrepare(){try{return window.CamCamNative?.prepareMicrophone?.()!==false}catch{return true}}
function nativeMicRelease(){try{window.CamCamNative?.releaseMicrophone?.()}catch{}}

async function acquireMic(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('دسترسی میکروفن در WebView موجود نیست');
  let last=null;
  const attempts=[
    {audio:true,video:false},
    {audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false},
    {audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false}
  ];
  for(let pass=0;pass<2;pass++){
    for(const cfg of attempts){
      try{return await navigator.mediaDevices.getUserMedia(cfg)}catch(e){last=e;await nap(220)}
    }
    nativeMicRelease();await nap(300);nativeMicPrepare();await nap(350);
  }
  const n=last?.name||'';
  if(n==='NotAllowedError'||n==='SecurityError')throw new Error('اجازه میکروفن برای CamCam فعال نیست');
  if(n==='NotReadableError'||String(last?.message||'').toLowerCase().includes('audio source'))throw new Error('میکروفن توسط اندروید یا برنامه دیگری درگیر است');
  throw last||new Error('میکروفن شروع نشد');
}

async function startTalkFixed(e){
  if(!activeId||activeDevice?.access==='viewer'||talkPC||talkBusy)return;
  e?.preventDefault();talkBusy=true;
  const b=document.getElementById('talk');if(b){b.classList.add('active');b.textContent='در حال آماده‌سازی میکروفن…'}
  try{
    if(!await nativeMicPermission())throw new Error('اجازه میکروفن داده نشد');
    nativeMicPrepare();await nap(180);
    const live=document.getElementById('liveVideo');if(live){viewerWasMuted=live.muted;live.muted=true;}
    talkStream=await acquireMic();
    await api(`/api/pet/devices/${activeId}/talk-wake`,{method:'POST'}).catch(()=>{});
    const auth=await api(`/api/pet/devices/${activeId}/talk-token`,{method:'POST'});
    const p=newPeer();talkPC=p;talkStream.getAudioTracks().forEach(t=>p.addTrack(t,talkStream));
    const offer=await p.createOffer();await p.setLocalDescription(offer);await waitIce(p);
    const r=await fetch(auth.whip_url,{method:'POST',headers:{'Content-Type':'application/sdp','Authorization':'Bearer '+auth.token},body:p.localDescription.sdp});
    if(!r.ok)throw new Error('مسیر صحبت برقرار نشد ('+r.status+')');
    talkResource=r.headers.get('Location');await p.setRemoteDescription({type:'answer',sdp:await r.text()});
    if(b)b.textContent='🎙 در حال صحبت…';
  }catch(err){toast('میکروفن شروع نشد: '+(err?.message||'خطای نامشخص'));await stopTalkFixed();}
  finally{talkBusy=false}
}

async function stopTalkFixed(){
  const b=document.getElementById('talk');if(b){b.classList.remove('active');b.textContent='🎙 نگه دار و صحبت کن'}
  if(talkStream)try{talkStream.getTracks().forEach(t=>t.stop())}catch{}talkStream=null;
  if(talkPC)try{talkPC.close()}catch{}talkPC=null;
  if(talkResource){try{await fetch(talkResource,{method:'DELETE'})}catch{}talkResource=null;}
  nativeMicRelease();
  const live=document.getElementById('liveVideo');if(live&&viewerWasMuted!==null)live.muted=viewerWasMuted;viewerWasMuted=null;
  talkBusy=false;
}

const old=document.getElementById('talk');
if(old){const fresh=old.cloneNode(true);old.parentNode.replaceChild(fresh,old);fresh.addEventListener('pointerdown',startTalkFixed,{passive:false});['pointerup','pointercancel','pointerleave'].forEach(ev=>fresh.addEventListener(ev,stopTalkFixed,{passive:true}));}
try{startTalk=startTalkFixed;stopTalk=stopTalkFixed}catch{}
setTimeout(()=>{try{if(activeId)loadHealth()}catch{}},300);
})();
