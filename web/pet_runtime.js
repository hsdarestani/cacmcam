(function(){
'use strict';

function injectStyle(){
  if(document.getElementById('camcam-pro-ui')) return;
  const s=document.createElement('style');
  s.id='camcam-pro-ui';
  s.textContent=`
  :root{
    --cc-bg:#f3f1ec;--cc-surface:#fffdfa;--cc-surface-2:#f7f5f0;--cc-ink:#102c2a;--cc-muted:#71807b;
    --cc-brand:#0b6f69;--cc-brand-2:#17958b;--cc-brand-soft:#e4f2ef;--cc-line:#e1ddd5;--cc-dark:#0b2321;
    --cc-danger:#b3495a;--cc-ok:#2e7b58;--cc-warn:#b2762f;--cc-shadow:0 18px 48px rgba(20,47,43,.09);
    --cc-shadow-sm:0 8px 24px rgba(20,47,43,.065);--cc-radius:24px;
  }
  *{-webkit-tap-highlight-color:transparent}
  html{background:var(--cc-bg)}
  body{background:
    radial-gradient(circle at 90% -10%,rgba(23,149,139,.13),transparent 30%),
    radial-gradient(circle at -8% 35%,rgba(223,172,116,.10),transparent 24%),
    linear-gradient(180deg,#f8f6f1 0%,var(--cc-bg) 52%,#f8f6f2 100%)!important;
    color:var(--cc-ink)!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif!important;
    min-height:100vh;background-attachment:fixed!important
  }
  button,input,select{font-family:inherit!important}
  button{touch-action:manipulation}
  .shell{width:min(1160px,100%)!important;padding:0 18px!important}
  .app{padding-bottom:108px!important}

  .top{height:76px!important;margin:0 -18px 18px!important;padding:0 18px!important;position:sticky!important;top:0;z-index:60;
    background:rgba(248,246,241,.88)!important;backdrop-filter:blur(22px);border-bottom:1px solid rgba(214,210,201,.72)!important}
  .logo{font-size:20px!important;letter-spacing:-.35px;color:var(--cc-dark)!important}.logo small{font-size:9px!important;color:var(--cc-muted)!important;margin-top:4px!important}
  .account{background:rgba(255,255,255,.64);border:1px solid var(--cc-line);border-radius:14px;padding:8px 12px!important;line-height:1.55}
  .account b{font-size:11px!important}.account span{font-size:9px!important}
  .top>.btn.danger{border-radius:12px!important;background:rgba(255,255,255,.55)!important}

  .layout{grid-template-columns:204px minmax(0,1fr)!important;gap:18px!important}
  .sidebar{position:sticky!important;top:96px!important;padding:10px!important;border:1px solid var(--cc-line)!important;border-radius:22px!important;
    background:rgba(255,253,250,.78)!important;backdrop-filter:blur(18px);box-shadow:var(--cc-shadow-sm)!important}
  .side{min-height:46px;border-radius:13px!important;font-size:11px!important;padding:12px 13px!important;transition:.18s ease}
  .side.active{background:var(--cc-dark)!important;color:white!important}.side:not(.active):hover{background:var(--cc-brand-soft)!important;color:var(--cc-brand)!important}

  .head{margin:2px 0 16px!important;align-items:flex-end!important}.head h1{font-size:28px!important;letter-spacing:-.75px!important;color:var(--cc-dark)!important}
  .head .muted{font-size:10px!important;color:var(--cc-muted)!important}.head .btn.primary{border-radius:14px!important;padding:11px 16px!important;box-shadow:0 10px 22px rgba(11,111,105,.16)}

  .summary{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;margin-bottom:14px!important}
  .sum{position:relative;min-height:94px;padding:15px!important;border-radius:19px!important;border:1px solid var(--cc-line)!important;
    background:rgba(255,253,250,.85)!important;box-shadow:var(--cc-shadow-sm)!important;overflow:hidden}
  .sum:before{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:var(--cc-brand-soft);font-size:15px;margin-bottom:7px}
  .sum:nth-child(1):before{content:'📷'}.sum:nth-child(2):before{content:'●';color:var(--cc-ok)}.sum:nth-child(3):before{content:'⚡'}.sum:nth-child(4):before{content:'◷'}
  .sum small{font-size:9px!important;color:var(--cc-muted)!important}.sum b{font-size:23px!important;margin-top:4px!important;color:var(--cc-dark)!important}

  .cams{gap:12px!important}.card{border-radius:22px!important;border:1px solid var(--cc-line)!important;background:rgba(255,253,250,.9)!important;box-shadow:var(--cc-shadow-sm)!important;overflow:hidden!important}
  .card:hover{transform:translateY(-2px);box-shadow:var(--cc-shadow)!important}.cover{height:174px!important;border-radius:21px 21px 0 0!important;
    background:linear-gradient(140deg,#b7d5cf 0%,#5f9d93 54%,#174b47 100%)!important}
  .cover:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(5,33,30,.36));pointer-events:none}
  .cover:after{font-size:76px!important;opacity:.11!important}.pill{font-size:9px!important;padding:6px 9px!important;background:rgba(255,253,247,.92)!important;backdrop-filter:blur(8px);box-shadow:0 5px 14px rgba(0,0,0,.06)}
  .body{padding:13px!important}.chip{background:#eef4f1!important;border-radius:999px!important;padding:5px 8px!important}.actions .btn{min-height:39px;border-radius:12px!important}

  .detail{margin-top:15px!important;padding:16px!important;border-radius:28px!important;border:1px solid var(--cc-line)!important;
    background:rgba(255,253,250,.9)!important;box-shadow:var(--cc-shadow)!important;overflow:hidden}
  .detail-head{padding:2px 2px 6px!important}.detail-head b{font-size:21px!important;letter-spacing:-.3px}.detail-head small{font-size:9px!important}
  .tabs{display:flex!important;gap:7px!important;margin:10px 0 14px!important;padding:3px!important;border-radius:16px;background:#f1efea!important;overflow-x:auto!important}
  .tab{flex:0 0 auto;border:0!important;background:transparent!important;border-radius:12px!important;padding:9px 13px!important;font-size:10px!important;color:var(--cc-muted)!important}
  .tab.active{background:white!important;color:var(--cc-dark)!important;box-shadow:0 4px 12px rgba(25,48,44,.07)!important}

  .video-grid{display:block!important;position:relative}.video{aspect-ratio:16/9!important;min-height:0!important;border-radius:23px!important;background:#020706!important;box-shadow:0 16px 38px rgba(5,24,22,.2)!important;border:1px solid #193b37!important;overflow:hidden!important}
  .video video{object-fit:contain!important;background:#000!important}.state{right:12px!important;top:12px!important;z-index:5!important;border-radius:999px!important;padding:7px 10px!important;
    background:rgba(255,252,245,.92)!important;backdrop-filter:blur(12px);box-shadow:0 5px 14px rgba(0,0,0,.08);font-size:9px!important}
  .cc-livebar{position:absolute;left:12px;right:12px;bottom:12px;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:8px;pointer-events:none}
  .cc-livebar span{background:rgba(9,30,28,.68);color:#f7fffd;border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(10px);border-radius:999px;padding:6px 9px;font-size:8px;font-weight:700}

  .care{display:grid!important;grid-template-columns:1fr!important;gap:9px!important;position:relative!important;margin:-18px 14px 0!important;padding:12px!important;z-index:8!important;
    border-radius:22px!important;background:rgba(255,253,250,.92)!important;border:1px solid rgba(255,255,255,.92)!important;backdrop-filter:blur(22px);box-shadow:0 18px 38px rgba(18,45,41,.13)!important}
  .talk{width:100%;min-height:64px!important;border-radius:17px!important;background:linear-gradient(135deg,var(--cc-brand),var(--cc-brand-2))!important;
    box-shadow:0 11px 24px rgba(11,111,105,.22)!important;font-size:13px!important;position:relative;overflow:hidden}
  .talk:after{content:'نگه دار';position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:8px;font-weight:700;opacity:.7;border:1px solid rgba(255,255,255,.25);padding:4px 7px;border-radius:999px}
  .talk.active{background:linear-gradient(135deg,#9d3e50,#cf6674)!important}.talk.active:after{content:'در حال ارسال صدا'}

  .controls{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important}
  .toggle,.action{min-height:68px!important;border-radius:16px!important;border:1px solid var(--cc-line)!important;background:white!important;padding:10px 11px!important;
    color:var(--cc-ink)!important;box-shadow:none!important;transition:.16s ease!important}
  .toggle:active,.action:active{transform:scale(.985)!important}.toggle{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;text-align:right!important}
  .cc-copy{display:grid!important;gap:3px!important}.cc-copy strong,.action strong{font-size:10.5px!important}.cc-copy small,.action small{font-size:8px!important;color:var(--cc-muted)!important;font-weight:500!important;line-height:1.5}
  .cc-switch{width:42px;height:25px;border-radius:99px;background:#d9d5cc;position:relative;flex:0 0 auto}.cc-switch:after{content:'';position:absolute;width:19px;height:19px;top:3px;right:3px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.17);transition:.18s}
  .toggle.on{background:#eef8f5!important;border-color:#a7cec6!important;color:var(--cc-brand)!important}.toggle.on .cc-switch{background:var(--cc-brand-2)}.toggle.on .cc-switch:after{right:20px}
  .action{display:grid!important;align-content:center!important;text-align:right!important}.manual.recording{background:#fff0f2!important;border-color:#e4b4bc!important;color:#9b3f4f!important}
  .toggle:disabled,.action:disabled,.talk:disabled{opacity:.45!important}

  #controlNote{min-height:34px!important;border-radius:12px!important;padding:8px 10px!important;background:#f6f4ef!important;border:1px solid #ebe6dd!important;font-size:8.5px!important;color:var(--cc-muted)!important;display:flex;align-items:center}
  #controlNote.cc-ok{background:#edf7f3!important;color:var(--cc-ok)!important;border-color:#cfe7dc!important}#controlNote.cc-bad{background:#fff1f2!important;color:var(--cc-danger)!important;border-color:#efcbd0!important}

  .zoomq{display:grid!important;grid-template-columns:minmax(0,1fr) 150px!important;gap:8px!important}.zoom,.quality{border-radius:14px!important;border:1px solid var(--cc-line)!important;background:white!important}
  .zoom{padding:10px 11px!important}.zoom div{font-size:9px!important}.zoom input{accent-color:var(--cc-brand-2)!important;height:20px!important}.quality{padding:10px!important}
  .phrases{display:flex!important;gap:6px!important;overflow-x:auto!important;padding-bottom:2px}.phrases .btn{flex:0 0 auto;border-radius:999px!important;padding:8px 11px!important;background:#f7f5f1!important;border-color:#e8e2d8!important;font-size:8.5px!important}
  .health{border-radius:12px!important;padding:9px 10px!important;background:#edf5f2!important;border:1px solid #d8e8e3!important;color:#365c56!important;font-size:8.5px!important}

  .pane{border-radius:19px!important;padding:13px!important;background:#faf8f4!important;border:1px solid var(--cc-line)!important}.pane>b{display:block;font-size:12px;margin-bottom:9px}
  .timeline{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px!important;overflow:visible!important}.event,.record,.share{min-width:0!important;max-width:none!important;border-radius:15px!important;border:1px solid var(--cc-line)!important;background:white!important;padding:9px!important;box-shadow:var(--cc-shadow-sm)!important}
  .event{display:grid!important;grid-template-columns:84px 1fr;align-items:center!important;gap:9px!important}.event img{width:84px!important;height:66px!important;border-radius:11px!important;object-fit:cover!important}.event .info{min-width:0}.event .btn{grid-column:1/-1;width:100%}
  .record{min-height:104px!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:space-between!important}.record .btn{width:100%}
  .share{grid-column:1/-1;display:flex!important;flex-direction:row!important;align-items:center!important;min-height:54px!important}.empty{grid-column:1/-1!important;background:rgba(255,255,255,.6)!important;border-radius:14px!important}

  .settings{gap:9px!important}.field input,.field select{border-radius:12px!important;border-color:var(--cc-line)!important;background:white!important;padding:11px!important}.switchrow{border-radius:13px!important;padding:11px!important;background:white!important}
  .modalback{backdrop-filter:blur(10px)!important}.modal{border-radius:24px!important;background:var(--cc-surface)!important;box-shadow:0 30px 90px rgba(0,0,0,.26)!important}.modal video{border-radius:16px!important}
  .toast{left:50%!important;transform:translateX(-50%);bottom:92px!important;max-width:min(420px,calc(100vw - 28px))!important;border-radius:14px!important;padding:11px 13px!important;background:rgba(9,35,32,.94)!important;backdrop-filter:blur(14px);font-size:9px!important;box-shadow:0 12px 30px rgba(0,0,0,.18)!important;text-align:center}

  .bottom{right:14px!important;left:14px!important;bottom:max(10px,env(safe-area-inset-bottom))!important;border-radius:20px!important;padding:6px!important;background:rgba(255,253,250,.92)!important;
    backdrop-filter:blur(22px);border:1px solid rgba(220,215,206,.92)!important;box-shadow:0 12px 32px rgba(21,48,44,.14)!important}
  .bottom button{min-height:48px!important;border-radius:14px!important;font-size:8px!important}.bottom button b{font-size:15px!important;margin-bottom:2px}.bottom button:active{background:var(--cc-brand-soft)!important;color:var(--cc-brand)!important}

  .landing .nav{height:76px!important}.landing .hero{gap:44px!important}.landing .hero h1{letter-spacing:-1.5px!important;color:var(--cc-dark)!important}.landing .hero-card{border-radius:34px!important;box-shadow:var(--cc-shadow)!important}

  @media(max-width:850px){
    .shell{padding:0 12px!important}.top{margin:0 -12px 12px!important;padding:0 12px!important;height:70px!important}.layout{grid-template-columns:1fr!important}.sidebar{display:none!important}
    .head{margin-bottom:12px!important}.head h1{font-size:22px!important}.summary{display:flex!important;overflow-x:auto!important;gap:8px!important;margin:0 -2px 12px!important;padding:2px 2px 7px!important;scrollbar-width:none}.summary::-webkit-scrollbar{display:none}.sum{flex:0 0 132px;min-height:82px!important;padding:12px!important}.sum:before{width:27px;height:27px;margin-bottom:5px}.sum b{font-size:20px!important}
    .cams{grid-template-columns:1fr!important}.cover{height:160px!important}.detail{margin:10px -2px 0!important;padding:10px!important;border-radius:24px!important}.detail-head{padding:4px 4px 7px!important}.tabs{margin:7px 0 10px!important}
    .video{border-radius:20px!important}.care{margin:-12px 7px 0!important;padding:10px!important;border-radius:19px!important}.talk{min-height:58px!important}.controls{grid-template-columns:1fr 1fr!important}.toggle,.action{min-height:62px!important}.zoomq{grid-template-columns:1fr!important}.health{line-height:1.7!important}
    .timeline{grid-template-columns:1fr!important}.event{grid-template-columns:72px 1fr!important}.event img{width:72px!important;height:58px!important}.event .btn{grid-column:1/-1!important}.record{min-height:94px!important}
    .top .account{display:none}.top .btn.danger{display:inline-flex!important}.logo{font-size:17px!important}.bottom{display:grid!important}
  }
  @media(max-width:520px){
    .shell{padding:0 8px!important}.top{margin:0 -8px 9px!important;padding:0 9px!important;height:64px!important}.app{padding-bottom:104px!important}.head{padding:0 3px!important}.head .btn.primary{padding:9px 11px!important;font-size:9px!important}
    .summary{margin-left:-1px!important;margin-right:-1px!important}.sum{flex-basis:118px;min-height:76px!important}.sum small{font-size:8px!important}.sum b{font-size:18px!important}
    .detail{padding:8px!important;border-radius:21px!important}.detail-head b{font-size:18px!important}.tabs{border-radius:14px!important}.tab{padding:8px 11px!important;font-size:9px!important}
    .video{border-radius:18px!important}.state{right:9px!important;top:9px!important;padding:6px 8px!important}.cc-livebar{left:9px;right:9px;bottom:9px}.cc-livebar span{font-size:7.5px;padding:5px 7px}
    .care{margin:-8px 5px 0!important;padding:8px!important}.talk{min-height:56px!important;font-size:12px!important}.talk:after{font-size:7px;left:10px}.toggle,.action{min-height:58px!important;padding:8px 9px!important}.cc-copy strong,.action strong{font-size:10px!important}.cc-copy small,.action small{font-size:7.5px!important}
    #controlNote{font-size:8px!important;min-height:31px!important}.phrases .btn{font-size:8px!important;padding:7px 9px!important}.health{font-size:8px!important}.pane{padding:10px!important}
    .bottom{right:8px!important;left:8px!important;padding:5px!important}.bottom button{min-height:46px!important}
  }
  `;
  document.head.appendChild(s);
}

function enhanceControls(){
  const torch=document.getElementById('torch');
  const low=document.getElementById('lowPower');
  const manual=document.getElementById('manual');
  if(torch&&!torch.querySelector('.cc-switch')) torch.innerHTML='<span class="cc-copy"><strong>🔦 چراغ</strong><small id="ccTorchState">خاموش</small></span><span class="cc-switch" aria-hidden="true"></span>';
  if(low&&!low.querySelector('.cc-switch')) low.innerHTML='<span class="cc-copy"><strong>🌙 کم‌مصرف</strong><small id="ccLowState">خاموش</small></span><span class="cc-switch" aria-hidden="true"></span>';
  const rotate=[...document.querySelectorAll('.action')].find(x=>(x.getAttribute('onclick')||'').includes('rotateCamera'));
  if(rotate&&!rotate.querySelector('strong')) rotate.innerHTML='<strong>🔄 دوربین</strong><small>جلو / پشت</small>';
  if(manual&&!manual.querySelector('strong')) manual.innerHTML='<strong id="ccManualTitle">⏺ ضبط دستی</strong><small id="ccManualState">برای شروع لمس کن</small>';

  const video=document.querySelector('#liveTab .video');
  if(video&&!video.querySelector('.cc-livebar')){
    const bar=document.createElement('div');
    bar.className='cc-livebar';
    bar.innerHTML='<span>🔒 اتصال خصوصی</span><span id="ccLiveQuality">Live</span>';
    video.appendChild(bar);
  }
}

function setNote2(msg,ok){
  const n=document.getElementById('controlNote');
  if(!n)return;
  n.textContent=msg||'';
  n.classList.remove('cc-ok','cc-bad');
  if(ok===true)n.classList.add('cc-ok');
  if(ok===false)n.classList.add('cc-bad');
}

injectStyle();
enhanceControls();

try{
  renderControl=function(){
    enhanceControls();
    const torch=document.getElementById('torch'),low=document.getElementById('lowPower');
    if(torch){torch.classList.toggle('on',!!control.torch);const x=document.getElementById('ccTorchState');if(x)x.textContent=control.torch?'روشن':'خاموش';}
    if(low){low.classList.toggle('on',!!control.low);const x=document.getElementById('ccLowState');if(x)x.textContent=control.low?'روشن':'خاموش';}
    const zr=document.getElementById('zoomRange'),zv=document.getElementById('zoomVal');
    if(zr)zr.value=control.zoom;if(zv)zv.textContent=Number(control.zoom).toFixed(1)+'×';
    const q=document.getElementById('ccLiveQuality');if(q)q.textContent=control.quality||'Live';
  };

  renderManual=function(){
    enhanceControls();
    const b=document.getElementById('manual');if(!b)return;
    const title=document.getElementById('ccManualTitle'),state=document.getElementById('ccManualState');
    if(manualActive){
      const n=Math.max(0,Math.floor((Date.now()-new Date(manualActive.started_at))/1000));
      b.classList.add('recording');if(title)title.textContent='⏹ پایان ضبط';if(state)state.textContent=n+' ثانیه در حال ضبط';
    }else{
      b.classList.remove('recording');if(title)title.textContent='⏺ ضبط دستی';if(state)state.textContent='برای شروع لمس کن';
    }
  };

  const baseCmd=cmd;
  cmd=async function(type,value,quiet=false){
    setNote2('در حال ارسال فرمان به دوربین…');
    const result=await baseCmd(type,value,true);
    if(result)setNote2(result.message||'فرمان اجرا شد.',result.ok!==false);
    else setNote2('فرمان ارسال شد؛ در حال همگام‌سازی وضعیت دوربین…',null);
    if(!quiet)toast(result?.message||'فرمان ارسال شد');
    return result;
  };

  syncControl=function(){
    const t=activeDevice?.telemetry||{},p=activeDevice?.pet||{};
    if(t.torch!=null)control.torch=!!t.torch;
    control.low=!!t.low_power;
    control.quality=t.quality||p.quality||'720p';
    if(t.zoom!=null)control.zoom=Number(t.zoom)||1;
    const q=document.getElementById('quality');if(q)q.value=control.quality;
    renderControl();
  };
}catch(e){console.warn('CamCam visual enhancement',e)}

const watch=new MutationObserver(()=>enhanceControls());
watch.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(()=>{try{renderControl();renderManual()}catch{}},0);
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
})();(function(){
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
})();function installFinal(){
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const generations={torch:0,low_power:0,zoom:0,camera:0,say:0,quality:0};
  const pending={torch:null,low_power:null};
  let streamGeneration=0;
  let streamRetryTimer=null;
  let streamToastSuppressions=0;
  const baseOpenLive=openLive;
  const baseCloseDetail=closeDetail;
  const realToast=toast;

  toast=function(text){
    const value=String(text||'');
    if(streamToastSuppressions>0&&/استریم پاسخ نداد|تصویر آماده نیست/.test(value))return;
    return realToast(text);
  };

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

  function liveState(text){
    const el=document.getElementById('liveState');
    if(el)el.textContent=text;
  }

  function watchConnected(){
    const s=watchPC?.connectionState;
    return s==='connected';
  }

  function scheduleStreamRetry(deviceId,generation,attempt,delay){
    clearTimeout(streamRetryTimer);
    streamRetryTimer=setTimeout(()=>{
      if(activeId===deviceId&&streamGeneration===generation){
        streamAttempt(deviceId,generation,attempt+1,true).catch(()=>{});
      }
    },delay);
  }

  async function streamAttempt(deviceId,generation,attempt=0,silent=true){
    if(streamGeneration!==generation)return;
    let health=null;
    try{health=await api(`/api/pet/devices/${deviceId}/health`)}catch{}
    if(activeId&&activeId!==deviceId)return;

    if(silent)streamToastSuppressions++;
    try{
      await baseOpenLive(deviceId);
    }catch{}
    finally{
      if(silent)streamToastSuppressions=Math.max(0,streamToastSuppressions-1);
    }

    if(streamGeneration!==generation||activeId!==deviceId)return;
    const state=watchPC?.connectionState||'none';
    if(state==='connected'){
      liveState('● زنده');
      return;
    }

    if(state==='new'||state==='connecting'){
      liveState('در حال برقراری تصویر…');
      clearTimeout(streamRetryTimer);
      streamRetryTimer=setTimeout(()=>{
        if(activeId!==deviceId||streamGeneration!==generation)return;
        if(watchConnected())liveState('● زنده');
        else streamAttempt(deviceId,generation,attempt+1,true).catch(()=>{});
      },3600);
      return;
    }

    const online=health?.online ?? activeDevice?.online;
    liveState(online?'گوشی آنلاین · بازیابی تصویر…':'گوشی دوربین آفلاین است');
    if(attempt===0){
      realToast(online?'گوشی دوربین آنلاین است؛ تصویر به‌صورت خودکار در حال بازیابی است.':'گوشی دوربین فعلاً آفلاین است.');
    }
    const delay=online?Math.min(6000,1200*Math.pow(1.55,Math.min(attempt,5))):5000;
    scheduleStreamRetry(deviceId,generation,attempt,delay);
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

    openLive=async function(id){
      clearTimeout(streamRetryTimer);
      const generation=++streamGeneration;
      await streamAttempt(id,generation,0,true);
    };

    closeDetail=function(){
      streamGeneration++;
      clearTimeout(streamRetryTimer);
      return baseCloseDetail();
    };

    window.__camcamViewerRuntimeFinal='13-stream-recovery';
    window.__camcamViewerStreamRecoveryV1=true;
    document.documentElement.dataset.camcamControlRuntime='13-stream-recovery';
  }catch(e){console.warn('CamCam final viewer runtime',e)}
}

installFinal();
