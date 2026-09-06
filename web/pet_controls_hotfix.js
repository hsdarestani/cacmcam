(function(){
'use strict';
const sleep2=ms=>new Promise(r=>setTimeout(r,ms));
function style(){
  if(document.getElementById('camcam-controls-hotfix-style')) return;
  const s=document.createElement('style');s.id='camcam-controls-hotfix-style';s.textContent=`
  .controls{gap:8px!important}.toggle,.action{min-height:64px!important;border-radius:16px!important;padding:10px 12px!important}
  .toggle{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;text-align:right!important;background:#fff!important;color:var(--ink)!important;border:1px solid var(--line)!important}
  .toggle .cc-copy{display:grid;gap:3px}.toggle .cc-copy strong{font-size:11px}.toggle .cc-copy small{font-size:8px;color:var(--muted);font-weight:500}
  .toggle .cc-switch{width:48px;height:28px;border-radius:99px;background:#ddd5c9;position:relative;flex:0 0 auto;transition:.2s}
  .toggle .cc-switch:after{content:'';position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 2px 7px rgba(0,0,0,.18);transition:.2s}
  .toggle.on{background:#f0f8f5!important;border-color:#8ab8af!important;color:var(--brand)!important}
  .toggle.on .cc-switch{background:var(--brand2)}.toggle.on .cc-switch:after{right:23px}
  .action{display:grid!important;align-content:center!important;text-align:right!important}.action strong{font-size:11px}.action small{font-size:8px;color:var(--muted);font-weight:500;margin-top:3px}
  #controlNote{border-radius:11px;padding:8px 10px;background:#f7f4ee}#controlNote.cc-ok{background:#edf7f3;color:#2f8158}#controlNote.cc-bad{background:#fff1f2;color:#a64050}
  `;document.head.appendChild(s);
}
function enhanceControls(){
  const torch=document.getElementById('torch'), low=document.getElementById('lowPower'), manual=document.getElementById('manual');
  if(torch&&!torch.querySelector('.cc-switch')) torch.innerHTML='<span class="cc-copy"><strong>🔦 چراغ</strong><small id="ccTorchState">خاموش</small></span><span class="cc-switch" aria-hidden="true"></span>';
  if(low&&!low.querySelector('.cc-switch')) low.innerHTML='<span class="cc-copy"><strong>🌙 حالت کم‌مصرف</strong><small id="ccLowState">خاموش</small></span><span class="cc-switch" aria-hidden="true"></span>';
  const rotate=[...document.querySelectorAll('.action')].find(x=>(x.getAttribute('onclick')||'').includes('rotateCamera'));
  if(rotate&&!rotate.querySelector('strong')) rotate.innerHTML='<strong>🔄 چرخش دوربین</strong><small>جابجایی بین دوربین جلو و پشت</small>';
  if(manual&&!manual.querySelector('strong')) manual.innerHTML='<strong id="ccManualTitle">⏺ ضبط دستی</strong><small id="ccManualState">برای شروع لمس کن</small>';
}
function setNote2(msg,ok){const n=document.getElementById('controlNote');if(!n)return;n.textContent=msg||'';n.classList.remove('cc-ok','cc-bad');if(ok===true)n.classList.add('cc-ok');if(ok===false)n.classList.add('cc-bad');}
style();enhanceControls();

try{
  renderControl=function(){
    enhanceControls();
    const torch=document.getElementById('torch'),low=document.getElementById('lowPower');
    if(torch){torch.classList.toggle('on',!!control.torch);const s=document.getElementById('ccTorchState');if(s)s.textContent=control.torch?'روشن':'خاموش';}
    if(low){low.classList.toggle('on',!!control.low);const s=document.getElementById('ccLowState');if(s)s.textContent=control.low?'روشن':'خاموش';}
    const zr=document.getElementById('zoomRange'),zv=document.getElementById('zoomVal');if(zr)zr.value=control.zoom;if(zv)zv.textContent=Number(control.zoom).toFixed(1)+'×';
  };
  renderManual=function(){
    enhanceControls();const b=document.getElementById('manual');if(!b)return;const title=document.getElementById('ccManualTitle'),state=document.getElementById('ccManualState');
    if(manualActive){const n=Math.max(0,Math.floor((Date.now()-new Date(manualActive.started_at))/1000));b.classList.add('recording');if(title)title.textContent='⏹ پایان ضبط';if(state)state.textContent=n+' ثانیه در حال ضبط';}
    else{b.classList.remove('recording');if(title)title.textContent='⏺ ضبط دستی';if(state)state.textContent='برای شروع لمس کن';}
  };
  const oldCmd=cmd;
  cmd=async function(type,value,quiet=false){setNote2('در حال اعمال روی دوربین…');const a=await oldCmd(type,value,true);if(a){setNote2(a.message||'دستور اجرا شد.',a.ok!==false);}else setNote2('پاسخ دوربین دریافت نشد.',false);if(!quiet)toast(a?.message||'پاسخ دوربین دریافت نشد');return a;};
  syncControl=function(){const t=activeDevice?.telemetry||{},p=activeDevice?.pet||{};if(t.torch!=null)control.torch=!!t.torch;control.low=!!t.low_power;control.quality=t.quality||p.quality||'720p';if(t.zoom!=null)control.zoom=Number(t.zoom)||1;const q=document.getElementById('quality');if(q)q.value=control.quality;renderControl();};
}catch(e){console.warn('CamCam controls override',e)}

let talkStarting2=false;
async function ensureMic2(){
  try{
    if(!window.CamCamNative?.hasMicrophonePermission) return true;
    if(window.CamCamNative.hasMicrophonePermission()) return true;
    return await new Promise(resolve=>{let settled=false;const done=e=>{if(settled)return;settled=true;resolve(!!e.detail?.granted)};window.addEventListener('camcam-native-mic',done,{once:true});window.CamCamNative.requestMicrophonePermission();setTimeout(()=>{if(!settled){settled=true;resolve(!!window.CamCamNative?.hasMicrophonePermission?.())}},7000)});
  }catch{return true}
}
async function getMic2(){let last=null;for(const cfg of [{audio:true,video:false},{audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},video:false}]){try{return await navigator.mediaDevices.getUserMedia(cfg)}catch(e){last=e;await sleep2(250)}}throw last||new Error('میکروفن در دسترس نیست')}
async function startTalk2(e){
  if(!activeId||activeDevice?.access==='viewer'||talkPC||talkStarting2)return;e?.preventDefault();talkStarting2=true;const b=document.getElementById('talk');b?.classList.add('active');if(b)b.textContent='در حال آماده‌سازی میکروفن…';
  try{
    if(!await ensureMic2())throw new Error('اجازه میکروفن داده نشد');
    talkStream=await getMic2();
    await api(`/api/pet/devices/${activeId}/talk-wake`,{method:'POST'}).catch(()=>{});
    const auth=await api(`/api/pet/devices/${activeId}/talk-token`,{method:'POST'}),p=newPeer();talkPC=p;talkStream.getTracks().forEach(t=>p.addTrack(t,talkStream));const o=await p.createOffer();await p.setLocalDescription(o);await waitIce(p);const r=await fetch(auth.whip_url,{method:'POST',headers:{'Content-Type':'application/sdp','Authorization':'Bearer '+auth.token},body:p.localDescription.sdp});if(!r.ok)throw new Error('مسیر صحبت برقرار نشد ('+r.status+')');talkResource=r.headers.get('Location');await p.setRemoteDescription({type:'answer',sdp:await r.text()});if(b)b.textContent='🎙 در حال صحبت…';
  }catch(err){toast('میکروفن شروع نشد: '+(err?.message||'خطای نامشخص'));await stopTalk2();}finally{talkStarting2=false}
}
async function stopTalk2(){const b=document.getElementById('talk');if(b){b.classList.remove('active');b.textContent='🎙 نگه دار و صحبت کن'}if(talkStream)talkStream.getTracks().forEach(t=>t.stop());talkStream=null;if(talkPC)try{talkPC.close()}catch{}talkPC=null;if(talkResource){try{await fetch(talkResource,{method:'DELETE'})}catch{}talkResource=null}talkStarting2=false}
const oldTalk=document.getElementById('talk');if(oldTalk){const fresh=oldTalk.cloneNode(true);oldTalk.parentNode.replaceChild(fresh,oldTalk);fresh.addEventListener('pointerdown',startTalk2,{passive:false});['pointerup','pointercancel','pointerleave'].forEach(x=>fresh.addEventListener(x,stopTalk2,{passive:true}));}
try{startTalk=startTalk2;stopTalk=stopTalk2;}catch{}
try{renderControl();renderManual();}catch{}
})();
