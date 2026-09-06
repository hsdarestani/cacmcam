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
})();