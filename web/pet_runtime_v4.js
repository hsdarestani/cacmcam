(function(){
'use strict';

const cc4Wait=ms=>new Promise(r=>setTimeout(r,ms));

function cc4Note(message,ok){
  const n=document.getElementById('controlNote');if(!n)return;
  n.textContent=message||'';n.classList.remove('cc-ok','cc-bad');
  if(ok===true)n.classList.add('cc-ok');else if(ok===false)n.classList.add('cc-bad');
}

function cc4ApplyTelemetry(t){
  if(!t)return;
  if(activeDevice)activeDevice.telemetry={...(activeDevice.telemetry||{}),...t};
  if(t.torch!=null)control.torch=!!t.torch;
  if(t.low_power!=null)control.low=!!t.low_power;
  if(t.zoom!=null)control.zoom=Math.max(1,Number(t.zoom)||1);
  if(t.quality){control.quality=t.quality;const q=document.getElementById('quality');if(q)q.value=t.quality;}
  try{renderControl()}catch{}
}

function cc4StateMatches(type,value,t,beforeFacing){
  if(!t)return false;
  if(type==='torch'&&t.torch!=null)return !!t.torch===!!value;
  if(type==='low_power'&&t.low_power!=null)return !!t.low_power===!!value;
  if(type==='zoom'&&t.zoom!=null)return Math.abs(Number(t.zoom)-Number(value))<0.16;
  if(type==='quality'&&t.quality)return String(t.quality)===String(value);
  if(type==='camera'&&t.facing&&beforeFacing)return String(t.facing)!==String(beforeFacing);
  return false;
}

function cc4Message(type,value){
  if(type==='torch')return value?'چراغ روشن شد.':'چراغ خاموش شد.';
  if(type==='low_power')return value?'حالت کم‌مصرف فعال شد.':'حالت کم‌مصرف خاموش شد.';
  if(type==='zoom')return 'زوم روی '+Number(value).toFixed(1)+'× اعمال شد.';
  if(type==='camera')return 'دوربین تغییر کرد.';
  if(type==='quality')return 'کیفیت '+String(value)+' اعمال شد.';
  if(type==='say')return 'صدا روی گوشی کنار پت اجرا شد.';
  return 'فرمان اجرا شد.';
}

async function cc4Command(type,value){
  const deviceId=activeId;
  if(!deviceId)return {ok:false,message:'دوربینی انتخاب نشده است.'};
  const beforeFacing=activeDevice?.telemetry?.facing||null;
  cc4Note('فرمان ارسال شد؛ منتظر تأیید مستقیم گوشی دوربین…');

  let commandId=null;
  try{
    const sent=await api(`/api/pet/devices/${deviceId}/command`,{method:'POST',body:JSON.stringify({type,value})});
    commandId=sent?.command?.id;
    if(!commandId)throw new Error('شناسه فرمان دریافت نشد');
  }catch(e){cc4Note(e.message,false);return {ok:false,message:e.message};}

  const deadline=Date.now()+10000;
  let tick=0;
  while(Date.now()<deadline&&activeId===deviceId){
    tick++;
    const tasks=[api(`/api/pet/devices/${deviceId}/commands/${encodeURIComponent(commandId)}/status`)];
    if(tick%2===0)tasks.push(api(`/api/pet/devices/${deviceId}/health`));
    if(tick%4===0)tasks.push(api(`/api/pet/devices/${deviceId}/events`));
    const results=await Promise.allSettled(tasks);

    const statusResult=results[0];
    if(statusResult.status==='fulfilled'&&statusResult.value?.ack){
      const ack=statusResult.value.ack;
      if(ack.applied_zoom!=null)control.zoom=Number(ack.applied_zoom)||control.zoom;
      cc4Note(ack.message||'فرمان اجرا شد.',ack.ok!==false);
      try{renderControl()}catch{}
      return ack;
    }

    const healthResult=results.find(r=>r.status==='fulfilled'&&r.value&&Object.prototype.hasOwnProperty.call(r.value,'telemetry'));
    if(healthResult?.status==='fulfilled'){
      const t=healthResult.value.telemetry||{};
      cc4ApplyTelemetry(t);
      if(cc4StateMatches(type,value,t,beforeFacing)){
        const result={ok:true,message:cc4Message(type,value),confirmed_by:'telemetry'};
        cc4Note(result.message,true);
        return result;
      }
    }

    const eventsResult=results.find(r=>r.status==='fulfilled'&&Array.isArray(r.value));
    if(eventsResult?.status==='fulfilled'){
      const ackEvent=eventsResult.value.find(x=>x.kind==='control_ack'&&String(x.metadata?.command_id||'')===String(commandId));
      if(ackEvent?.metadata){
        const ack=ackEvent.metadata;
        cc4Note(ack.message||'فرمان اجرا شد.',ack.ok!==false);
        return ack;
      }
    }
    await cc4Wait(280);
  }

  const msg='گوشی دوربین آنلاین است ولی تأیید فرمان برنگشت؛ اتصال کنترل را تازه می‌کنم.';
  cc4Note(msg,null);
  setTimeout(()=>activeId===deviceId&&loadHealth(),400);
  setTimeout(()=>activeId===deviceId&&loadHealth(),1400);
  return {ok:null,pending:true,message:msg};
}

try{
  cmd=async function(type,value,quiet=false){const r=await cc4Command(type,value);if(!quiet)toast(r.message);return r;};
  toggleTorch=async function(){
    const b=document.getElementById('torch');if(b?.disabled)return;
    const before=!!control.torch,want=!before;b.disabled=true;
    const r=await cc4Command('torch',want);
    if(r.ok===true)control.torch=want;else if(r.ok===false)control.torch=before;
    try{renderControl()}catch{};b.disabled=false;toast(r.message);
  };
  toggleLowPower=async function(){
    const b=document.getElementById('lowPower');if(b?.disabled)return;
    const before=!!control.low,want=!before;b.disabled=true;
    const r=await cc4Command('low_power',want);
    if(r.ok===true)control.low=want;else if(r.ok===false)control.low=before;
    try{renderControl()}catch{};b.disabled=false;toast(r.message);
  };
  rotateCamera=async function(b){if(b)b.disabled=true;const r=await cc4Command('camera','switch');if(b)b.disabled=false;toast(r.message);if(r.ok!==false)setTimeout(()=>activeId&&openLive(activeId),700);};
  commitZoom=async function(v){const wanted=Number(v),r=await cc4Command('zoom',wanted);if(r.applied_zoom!=null)control.zoom=Number(r.applied_zoom);else if(r.ok!==false)control.zoom=wanted;try{renderControl()}catch{};toast(r.message);};
  phrase=async function(text,b){if(b)b.disabled=true;const r=await cc4Command('say',text);if(b)b.disabled=false;toast(r.message);};
}catch(e){console.warn('CamCam viewer command v4',e);}

window.__camcamViewerRuntimeV4=true;
})();
