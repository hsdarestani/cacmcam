(function(){
'use strict';
function load(src,done){const s=document.createElement('script');s.src=src;s.async=false;s.onload=()=>done&&done();s.onerror=()=>done&&done();document.head.appendChild(s)}
function installFinal(){
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const pending={torch:null,low_power:null};
  const note=(m,ok)=>{const n=document.getElementById('controlNote');if(!n)return;n.textContent=m||'';n.classList.remove('cc-ok','cc-bad');if(ok===true)n.classList.add('cc-ok');else if(ok===false)n.classList.add('cc-bad')};
  const render=()=>{try{renderControl()}catch{}};
  const msg=(t,v)=>t==='torch'?(v?'چراغ روشن شد.':'چراغ خاموش شد.'):t==='low_power'?(v?'حالت کم‌مصرف فعال شد.':'حالت کم‌مصرف خاموش شد.'):t==='zoom'?'زوم روی '+Number(v).toFixed(1)+'× اعمال شد.':t==='camera'?'دوربین تغییر کرد.':t==='say'?'صدا روی گوشی کنار پت اجرا شد.':'فرمان اجرا شد.';
  const apply=(t,v)=>{if(t==='torch')control.torch=!!v;if(t==='low_power')control.low=!!v;if(t==='zoom')control.zoom=Math.max(1,Number(v)||1);if(activeDevice)activeDevice.telemetry={...(activeDevice.telemetry||{}),torch:control.torch,low_power:control.low,zoom:control.zoom};render()};
  const telemetry=(t)=>{if(!t)return;if(t.torch!=null&&(pending.torch===null||!!t.torch===pending.torch)){control.torch=!!t.torch;if(pending.torch===control.torch)pending.torch=null}if(t.low_power!=null&&(pending.low_power===null||!!t.low_power===pending.low_power)){control.low=!!t.low_power;if(pending.low_power===control.low)pending.low_power=null}if(t.zoom!=null)control.zoom=Math.max(1,Number(t.zoom)||1);if(t.quality){control.quality=t.quality;const q=document.getElementById('quality');if(q)q.value=t.quality}if(activeDevice)activeDevice.telemetry={...(activeDevice.telemetry||{}),...t};render()};
  const match=(type,value,t)=>type==='torch'&&t?.torch!=null?!!t.torch===!!value:type==='low_power'&&t?.low_power!=null?!!t.low_power===!!value:type==='zoom'&&t?.zoom!=null?Math.abs(Number(t.zoom)-Number(value))<.16:false;
  const command=async(type,value)=>{
    const deviceId=activeId;if(!deviceId)return{ok:false,message:'دوربینی انتخاب نشده است.'};note('فرمان ارسال شد؛ منتظر وضعیت واقعی گوشی دوربین…');let id=null;
    try{const s=await api(`/api/pet/devices/${deviceId}/command`,{method:'POST',body:JSON.stringify({type,value})});id=s?.command?.id;if(!id)throw new Error('شناسه فرمان دریافت نشد')}catch(e){note(e.message,false);return{ok:false,message:e.message}};
    const end=Date.now()+9000;while(Date.now()<end&&activeId===deviceId){const rs=await Promise.allSettled([api(`/api/pet/devices/${deviceId}/commands/${encodeURIComponent(id)}/status`),api(`/api/pet/devices/${deviceId}/health`),api(`/api/pet/devices/${deviceId}/events`)]);const st=rs[0],hl=rs[1],ev=rs[2];
      if(st.status==='fulfilled'&&st.value?.ack){const a=st.value.ack;if(a.ok!==false)apply(type,a.applied_zoom??value);note(a.message||msg(type,value),a.ok!==false);return a}
      if(ev.status==='fulfilled'){const a=(ev.value||[]).find(x=>x.kind==='control_ack'&&String(x.metadata?.command_id||'')===String(id))?.metadata;if(a){if(a.ok!==false)apply(type,a.applied_zoom??value);note(a.message||msg(type,value),a.ok!==false);return a}}
      if(hl.status==='fulfilled'){const t=hl.value?.telemetry||{};telemetry(t);if(match(type,value,t)){const a={ok:true,message:msg(type,value),confirmed_by:'telemetry'};note(a.message,true);return a}}
      await wait(300)
    }
    const m='فرمان به گوشی دوربین رسید؛ وضعیت سوییچ بر اساس آخرین فرمان نگه داشته می‌شود.';note(m,null);return{ok:null,pending:true,message:m}
  };
  try{
    cmd=async function(type,value,quiet=false){const r=await command(type,value);if(!quiet)toast(r.message);return r};
    toggleTorch=async function(){const b=document.getElementById('torch');if(b?.disabled)return;const before=!!control.torch,want=!before;pending.torch=want;apply('torch',want);b.disabled=true;const r=await command('torch',want);b.disabled=false;if(r.ok===false){pending.torch=null;apply('torch',before)}else if(r.ok===true)pending.torch=null;toast(r.message)};
    toggleLowPower=async function(){const b=document.getElementById('lowPower');if(b?.disabled)return;const before=!!control.low,want=!before;pending.low_power=want;apply('low_power',want);b.disabled=true;const r=await command('low_power',want);b.disabled=false;if(r.ok===false){pending.low_power=null;apply('low_power',before)}else if(r.ok===true)pending.low_power=null;toast(r.message)};
    commitZoom=async function(v){const w=Number(v);apply('zoom',w);const r=await command('zoom',w);if(r.applied_zoom!=null)apply('zoom',r.applied_zoom);toast(r.message)};
    rotateCamera=async function(b){if(b)b.disabled=true;const r=await command('camera','switch');if(b)b.disabled=false;toast(r.message);if(r.ok!==false)setTimeout(()=>activeId&&openLive(activeId),650)};
    phrase=async function(text,b){if(b)b.disabled=true;const r=await command('say',text);if(b)b.disabled=false;toast(r.message)};
    window.__camcamViewerRuntimeFinal='11-inline';
  }catch(e){console.warn('CamCam final viewer runtime',e)}
}
load('/static/pet_controls_visual.js?v=11',()=>load('/static/pet_runtime_fix.js?v=11',()=>load('/static/pet_runtime_v2.js?v=11',()=>load('/static/pet_runtime_v3.js?v=11',()=>load('/static/pet_runtime_v4.js?v=11',installFinal)))));
})();
