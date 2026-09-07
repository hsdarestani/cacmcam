(function(){
'use strict';

const cc5Wait=ms=>new Promise(r=>setTimeout(r,ms));
const cc5Pending={torch:null,low_power:null};

function cc5Note(message,ok){
  const n=document.getElementById('controlNote');if(!n)return;
  n.textContent=message||'';n.classList.remove('cc-ok','cc-bad');
  if(ok===true)n.classList.add('cc-ok');else if(ok===false)n.classList.add('cc-bad');
}
function cc5Render(){try{renderControl()}catch{}}
function cc5Message(type,value){
  if(type==='torch')return value?'چراغ روشن شد.':'چراغ خاموش شد.';
  if(type==='low_power')return value?'حالت کم‌مصرف فعال شد.':'حالت کم‌مصرف خاموش شد.';
  if(type==='zoom')return 'زوم روی '+Number(value).toFixed(1)+'× اعمال شد.';
  if(type==='camera')return 'دوربین تغییر کرد.';
  if(type==='say')return 'صدا روی گوشی کنار پت اجرا شد.';
  return 'فرمان اجرا شد.';
}
function cc5Apply(type,value){
  if(type==='torch')control.torch=!!value;
  if(type==='low_power')control.low=!!value;
  if(type==='zoom')control.zoom=Math.max(1,Number(value)||1);
  if(activeDevice)activeDevice.telemetry={...(activeDevice.telemetry||{}),torch:control.torch,low_power:control.low,zoom:control.zoom};
  cc5Render();
}
function cc5TelemetryMatch(type,value,t){
  if(!t)return false;
  if(type==='torch'&&t.torch!=null)return !!t.torch===!!value;
  if(type==='low_power'&&t.low_power!=null)return !!t.low_power===!!value;
  if(type==='zoom'&&t.zoom!=null)return Math.abs(Number(t.zoom)-Number(value))<0.16;
  return false;
}
function cc5ApplyTelemetry(t){
  if(!t)return;
  if(t.torch!=null&&(cc5Pending.torch===null||!!t.torch===cc5Pending.torch)){
    control.torch=!!t.torch;if(cc5Pending.torch===control.torch)cc5Pending.torch=null;
  }
  if(t.low_power!=null&&(cc5Pending.low_power===null||!!t.low_power===cc5Pending.low_power)){
    control.low=!!t.low_power;if(cc5Pending.low_power===control.low)cc5Pending.low_power=null;
  }
  if(t.zoom!=null)control.zoom=Math.max(1,Number(t.zoom)||1);
  if(t.quality){control.quality=t.quality;const q=document.getElementById('quality');if(q)q.value=t.quality;}
  if(activeDevice)activeDevice.telemetry={...(activeDevice.telemetry||{}),...t};
  cc5Render();
}

async function cc5Command(type,value){
  const deviceId=activeId;
  if(!deviceId)return {ok:false,message:'دوربینی انتخاب نشده است.'};
  cc5Note('فرمان ارسال شد؛ منتظر وضعیت واقعی گوشی دوربین…');
  let commandId=null;
  try{
    const sent=await api(`/api/pet/devices/${deviceId}/command`,{method:'POST',body:JSON.stringify({type,value})});
    commandId=sent?.command?.id;
    if(!commandId)throw new Error('شناسه فرمان دریافت نشد');
  }catch(e){cc5Note(e.message,false);return {ok:false,message:e.message};}

  const deadline=Date.now()+9000;
  while(Date.now()<deadline&&activeId===deviceId){
    const [statusRes,healthRes,eventsRes]=await Promise.allSettled([
      api(`/api/pet/devices/${deviceId}/commands/${encodeURIComponent(commandId)}/status`),
      api(`/api/pet/devices/${deviceId}/health`),
      api(`/api/pet/devices/${deviceId}/events`)
    ]);
    if(statusRes.status==='fulfilled'&&statusRes.value?.ack){
      const a=statusRes.value.ack;
      if(a.ok!==false)cc5Apply(type,a.applied_zoom??value);
      cc5Note(a.message||cc5Message(type,value),a.ok!==false);
      return a;
    }
    if(eventsRes.status==='fulfilled'){
      const a=(eventsRes.value||[]).find(x=>x.kind==='control_ack'&&String(x.metadata?.command_id||'')===String(commandId))?.metadata;
      if(a){if(a.ok!==false)cc5Apply(type,a.applied_zoom??value);cc5Note(a.message||cc5Message(type,value),a.ok!==false);return a;}
    }
    if(healthRes.status==='fulfilled'){
      const t=healthRes.value?.telemetry||{};cc5ApplyTelemetry(t);
      if(cc5TelemetryMatch(type,value,t)){
        const a={ok:true,message:cc5Message(type,value),confirmed_by:'telemetry'};
        cc5Note(a.message,true);return a;
      }
    }
    await cc5Wait(300);
  }
  const msg='فرمان به گوشی دوربین رسید؛ وضعیت سوییچ موقتاً بر اساس آخرین فرمان نگه داشته می‌شود.';
  cc5Note(msg,null);
  return {ok:null,pending:true,message:msg};
}

try{
  cmd=async function(type,value,quiet=false){const r=await cc5Command(type,value);if(!quiet)toast(r.message);return r;};
  toggleTorch=async function(){
    const b=document.getElementById('torch');if(b?.disabled)return;
    const before=!!control.torch,want=!before;cc5Pending.torch=want;cc5Apply('torch',want);b.disabled=true;
    const r=await cc5Command('torch',want);b.disabled=false;
    if(r.ok===false){cc5Pending.torch=null;cc5Apply('torch',before);}else if(r.ok===true)cc5Pending.torch=null;
    toast(r.message);
  };
  toggleLowPower=async function(){
    const b=document.getElementById('lowPower');if(b?.disabled)return;
    const before=!!control.low,want=!before;cc5Pending.low_power=want;cc5Apply('low_power',want);b.disabled=true;
    const r=await cc5Command('low_power',want);b.disabled=false;
    if(r.ok===false){cc5Pending.low_power=null;cc5Apply('low_power',before);}else if(r.ok===true)cc5Pending.low_power=null;
    toast(r.message);
  };
  commitZoom=async function(v){const wanted=Number(v);cc5Apply('zoom',wanted);const r=await cc5Command('zoom',wanted);if(r.applied_zoom!=null)cc5Apply('zoom',r.applied_zoom);toast(r.message);};
  rotateCamera=async function(b){if(b)b.disabled=true;const r=await cc5Command('camera','switch');if(b)b.disabled=false;toast(r.message);if(r.ok!==false)setTimeout(()=>activeId&&openLive(activeId),650);};
  phrase=async function(text,b){if(b)b.disabled=true;const r=await cc5Command('say',text);if(b)b.disabled=false;toast(r.message);};
}catch(e){console.warn('CamCam viewer runtime v5',e);}

window.__camcamViewerRuntimeV5=true;
})();
