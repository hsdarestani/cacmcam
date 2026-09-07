(function(){
'use strict';

function load(src,done){
  const s=document.createElement('script');
  s.src=src;
  s.async=false;
  s.onload=()=>done&&done();
  s.onerror=()=>done&&done();
  document.head.appendChild(s);
}

function installFinal(){
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const generations={torch:0,low_power:0,zoom:0,camera:0,say:0,quality:0};
  const pending={torch:null,low_power:null};

  const note=(message,ok)=>{
    const n=document.getElementById('controlNote');
    if(!n)return;
    n.textContent=message||'';
    n.classList.remove('cc-ok','cc-bad');
    if(ok===true)n.classList.add('cc-ok');
    else if(ok===false)n.classList.add('cc-bad');
  };
  const render=()=>{try{renderControl()}catch{}};
  const message=(type,value)=>{
    if(type==='torch')return value?'چراغ روشن شد.':'چراغ خاموش شد.';
    if(type==='low_power')return value?'حالت کم‌مصرف فعال شد.':'حالت کم‌مصرف خاموش شد.';
    if(type==='zoom')return 'زوم روی '+Number(value).toFixed(1)+'× اعمال شد.';
    if(type==='camera')return 'دوربین تغییر کرد.';
    if(type==='quality')return 'کیفیت '+String(value)+' اعمال شد.';
    if(type==='say')return 'صدا روی گوشی کنار پت اجرا شد.';
    return 'فرمان اجرا شد.';
  };

  function apply(type,value){
    if(type==='torch')control.torch=!!value;
    if(type==='low_power')control.low=!!value;
    if(type==='zoom')control.zoom=Math.max(1,Number(value)||1);
    if(activeDevice){
      activeDevice.telemetry={...(activeDevice.telemetry||{})};
      if(type==='torch')activeDevice.telemetry.torch=!!value;
      if(type==='low_power')activeDevice.telemetry.low_power=!!value;
      if(type==='zoom')activeDevice.telemetry.zoom=Math.max(1,Number(value)||1);
    }
    render();
  }

  function applyTelemetry(t){
    if(!t)return;
    if(t.torch!=null&&(pending.torch===null||!!t.torch===pending.torch)){
      control.torch=!!t.torch;
      if(pending.torch===control.torch)pending.torch=null;
    }
    if(t.low_power!=null&&(pending.low_power===null||!!t.low_power===pending.low_power)){
      control.low=!!t.low_power;
      if(pending.low_power===control.low)pending.low_power=null;
    }
    if(t.zoom!=null)control.zoom=Math.max(1,Number(t.zoom)||1);
    if(t.quality){
      control.quality=t.quality;
      const q=document.getElementById('quality');
      if(q)q.value=t.quality;
    }
    if(activeDevice)activeDevice.telemetry={...(activeDevice.telemetry||{}),...t};
    render();
  }

  function matches(type,value,t){
    if(!t)return false;
    if(type==='torch'&&t.torch!=null)return !!t.torch===!!value;
    if(type==='low_power'&&t.low_power!=null)return !!t.low_power===!!value;
    if(type==='zoom'&&t.zoom!=null)return Math.abs(Number(t.zoom)-Number(value))<0.16;
    return false;
  }

  async function monitor(deviceId,commandId,type,value,generation){
    const end=Date.now()+8500;
    while(Date.now()<end&&activeId===deviceId&&generations[type]===generation){
      const rs=await Promise.allSettled([
        api(`/api/pet/devices/${deviceId}/commands/${encodeURIComponent(commandId)}/status`),
        api(`/api/pet/devices/${deviceId}/health`),
        api(`/api/pet/devices/${deviceId}/events`)
      ]);

      const st=rs[0];
      if(st.status==='fulfilled'&&st.value?.ack){
        const a=st.value.ack;
        if(generations[type]!==generation)return a;
        if(a.ok!==false){
          const applied=a.applied_zoom!=null?a.applied_zoom:value;
          apply(type,applied);
          if(type==='torch')pending.torch=null;
          if(type==='low_power')pending.low_power=null;
        }
        note(a.message||message(type,value),a.ok!==false);
        return a;
      }

      const ev=rs[2];
      if(ev.status==='fulfilled'){
        const a=(ev.value||[]).find(x=>x.kind==='control_ack'&&String(x.metadata?.command_id||'')===String(commandId))?.metadata;
        if(a){
          if(generations[type]!==generation)return a;
          if(a.ok!==false){
            const applied=a.applied_zoom!=null?a.applied_zoom:value;
            apply(type,applied);
            if(type==='torch')pending.torch=null;
            if(type==='low_power')pending.low_power=null;
          }
          note(a.message||message(type,value),a.ok!==false);
          return a;
        }
      }

      const hl=rs[1];
      if(hl.status==='fulfilled'){
        const t=hl.value?.telemetry||{};
        applyTelemetry(t);
        if(matches(type,value,t)){
          if(type==='torch')pending.torch=null;
          if(type==='low_power')pending.low_power=null;
          const a={ok:true,message:message(type,value),confirmed_by:'telemetry'};
          note(a.message,true);
          return a;
        }
      }
      await wait(350);
    }
    if(generations[type]===generation){
      note('فرمان ارسال شد؛ وضعیت سوییچ بر اساس آخرین فرمان نگه داشته شد.',null);
    }
    return {ok:null,pending:true,message:'فرمان ارسال شد؛ وضعیت سوییچ بر اساس آخرین فرمان نگه داشته شد.'};
  }

  async function send(type,value,{optimistic=false,previousValue=null}={}){
    const deviceId=activeId;
    if(!deviceId)return {ok:false,message:'دوربینی انتخاب نشده است.'};
    const generation=(generations[type]||0)+1;
    generations[type]=generation;

    if(optimistic){
      if(type==='torch')pending.torch=!!value;
      if(type==='low_power')pending.low_power=!!value;
      apply(type,value);
    }
    note('فرمان ارسال شد؛ در حال همگام‌سازی وضعیت دوربین…',null);

    let commandId;
    try{
      const sent=await api(`/api/pet/devices/${deviceId}/command`,{method:'POST',body:JSON.stringify({type,value})});
      commandId=sent?.command?.id;
      if(!commandId)throw new Error('شناسه فرمان دریافت نشد');
    }catch(e){
      if(generations[type]===generation&&optimistic){
        if(type==='torch')pending.torch=null;
        if(type==='low_power')pending.low_power=null;
        apply(type,previousValue);
      }
      note(e.message,false);
      return {ok:false,message:e.message};
    }

    monitor(deviceId,commandId,type,value,generation).then(result=>{
      if(result?.message&&generations[type]===generation)toast(result.message);
    }).catch(()=>{});
    return {ok:true,queued:true,message:'فرمان ارسال شد.'};
  }

  try{
    toggleTorch=async function(){
      const before=!!control.torch;
      const want=!before;
      const r=await send('torch',want,{optimistic:true,previousValue:before});
      if(r.ok===false)toast(r.message);
    };

    toggleLowPower=async function(){
      const before=!!control.low;
      const want=!before;
      const r=await send('low_power',want,{optimistic:true,previousValue:before});
      if(r.ok===false)toast(r.message);
    };

    commitZoom=async function(v){
      const before=Number(control.zoom)||1;
      const wanted=Number(v);
      const r=await send('zoom',wanted,{optimistic:true,previousValue:before});
      if(r.ok===false)toast(r.message);
    };

    rotateCamera=async function(b){
      if(b)b.disabled=true;
      const r=await send('camera','switch');
      if(b)b.disabled=false;
      if(r.ok===false)toast(r.message);
      else setTimeout(()=>activeId&&openLive(activeId),800);
    };

    phrase=async function(text,b){
      if(b)b.disabled=true;
      const r=await send('say',text);
      if(b)b.disabled=false;
      if(r.ok===false)toast(r.message);
    };

    cmd=async function(type,value,quiet=false){
      const r=await send(type,value);
      if(!quiet&&r.message)toast(r.message);
      return r;
    };

    window.__camcamViewerRuntimeFinal='12-direct';
    document.documentElement.dataset.camcamControlRuntime='12-direct';
  }catch(e){console.warn('CamCam final viewer runtime',e)}
}

// Only load routes that Caddy explicitly serves. Older bundles chained through
// v3/v4 URLs that were not mapped on production WebViews and could prevent the
// final control layer from ever being installed.
load('/static/pet_controls_visual.js?v=12',()=>
  load('/static/pet_runtime_fix.js?v=12',()=>
    load('/static/pet_runtime_v2.js?v=12',installFinal)
  )
);
})();
