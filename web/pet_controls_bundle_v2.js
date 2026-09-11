(function(){
'use strict';
const rev=Date.now();
function load(src,done){const s=document.createElement('script');s.src=src;s.async=false;s.onload=()=>done&&done();s.onerror=()=>done&&done();document.head.appendChild(s)}
function installFontNow(){
  if(!document.getElementById('cc-estedad-boot')){const l=document.createElement('link');l.id='cc-estedad-boot';l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Estedad:wght@400;500;600;700;800&display=swap&v='+rev;document.head.appendChild(l)}
  if(!document.getElementById('cc-font-boot-style')){const s=document.createElement('style');s.id='cc-font-boot-style';s.textContent='body,button,input,select,textarea{font-family:"Estedad","Noto Sans Arabic","Noto Naskh Arabic",Tahoma,Arial,sans-serif!important}';document.head.appendChild(s)}
}
function installRedesign(){
  if(document.getElementById('cc-viewer-redesign-v3'))return;
  const s=document.createElement('style');
  s.id='cc-viewer-redesign-v3';
  s.textContent=`
  :root{
    --v3-bg:#f3f5f2;--v3-surface:#ffffff;--v3-ink:#142522;--v3-muted:#75837f;
    --v3-dark:#132825;--v3-dark-2:#1c3d38;--v3-accent:#6fd8c4;--v3-soft:#e9f5f1;
    --v3-line:#e2e8e4;--v3-shadow:0 12px 34px rgba(27,55,49,.09);--v3-shadow-lg:0 22px 54px rgba(20,44,39,.15)
  }
  html,body{background:var(--v3-bg)!important;color:var(--v3-ink)!important}
  body{background-image:none!important;font-size:14px!important}
  .shell{width:min(1080px,100%)!important;padding:0 18px!important}
  .app{padding-bottom:112px!important}

  .top{height:88px!important;margin:0 -18px 24px!important;padding:0 22px!important;border:0!important;border-radius:0 0 30px 30px!important;
    background:linear-gradient(135deg,var(--v3-dark) 0%,var(--v3-dark-2) 100%)!important;box-shadow:0 14px 34px rgba(15,42,37,.18)!important;backdrop-filter:none!important}
  .top .logo{color:#fff!important;font-size:22px!important;letter-spacing:-.5px!important}.top .logo small{color:#a9c5bf!important;font-size:10px!important}
  .top .account{background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.12)!important;color:#dce9e5!important}
  .top .account b{color:#fff!important}.top>.btn.danger{background:rgba(255,255,255,.09)!important;border-color:rgba(255,255,255,.16)!important;color:#fff!important}

  .layout{gap:22px!important}.sidebar{border:0!important;background:var(--v3-dark)!important;box-shadow:var(--v3-shadow)!important;border-radius:24px!important}
  .side{color:#aec4bf!important;font-size:12px!important}.side.active{background:var(--v3-accent)!important;color:#12312b!important}.side:not(.active):hover{background:rgba(255,255,255,.08)!important;color:#fff!important}

  .head{position:relative;min-height:118px;margin:0 0 18px!important;padding:22px 24px!important;border-radius:26px!important;overflow:hidden!important;
    background:linear-gradient(130deg,#ffffff 0%,#edf6f2 100%)!important;border:1px solid #e1ebe7!important;box-shadow:var(--v3-shadow)!important;align-items:center!important}
  .head:after{content:'🐾';position:absolute;left:28px;bottom:-28px;font-size:112px;opacity:.055;pointer-events:none}
  .head h1{font-size:30px!important;letter-spacing:-1px!important;color:var(--v3-ink)!important}.head .muted{font-size:11px!important;color:var(--v3-muted)!important}
  .head .btn.primary{min-height:48px!important;padding:0 18px!important;border:0!important;border-radius:16px!important;background:var(--v3-dark)!important;color:#fff!important;box-shadow:none!important}

  .summary{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;margin:0 0 18px!important;padding:0!important;overflow:visible!important}
  .sum{min-width:0!important;min-height:108px!important;padding:16px!important;border:0!important;border-radius:21px!important;background:#fff!important;box-shadow:var(--v3-shadow)!important}
  .sum:before{width:35px!important;height:35px!important;border-radius:12px!important;background:var(--v3-soft)!important;margin-bottom:9px!important}
  .sum small{font-size:10px!important;color:var(--v3-muted)!important}.sum b{font-size:25px!important;color:var(--v3-ink)!important;font-weight:800!important}

  .cams{gap:16px!important}.card{border:0!important;border-radius:28px!important;background:#fff!important;box-shadow:var(--v3-shadow)!important;transition:transform .2s ease,box-shadow .2s ease!important}
  .card:hover{transform:translateY(-3px)!important;box-shadow:var(--v3-shadow-lg)!important}
  .cover{height:205px!important;border-radius:28px 28px 0 0!important;padding:18px!important;background:linear-gradient(145deg,#244a43 0%,#1c756b 55%,#75c8b9 125%)!important}
  .cover:before{background:radial-gradient(circle at 20% 10%,rgba(255,255,255,.18),transparent 30%),linear-gradient(180deg,transparent,rgba(5,31,27,.34))!important}
  .cover:after{font-size:92px!important;opacity:.075!important;left:28px!important;top:34px!important}
  .pill{padding:7px 11px!important;font-size:10px!important;border:1px solid rgba(255,255,255,.22)!important;background:rgba(255,255,255,.92)!important;box-shadow:none!important}
  .body{padding:16px!important}.body .chips{gap:7px!important;margin-bottom:13px!important}.chip{padding:6px 9px!important;font-size:10px!important;background:#f0f5f3!important;color:#536862!important}
  .actions{display:grid!important;grid-template-columns:1.35fr 1fr 1fr!important;gap:8px!important}.actions .btn{min-height:48px!important;border-radius:15px!important;font-size:11px!important;border-color:var(--v3-line)!important;background:#fff!important}
  .actions .btn.primary{background:var(--v3-dark)!important;border-color:var(--v3-dark)!important;color:#fff!important}

  .detail{border:0!important;border-radius:28px!important;background:#fff!important;box-shadow:var(--v3-shadow-lg)!important;padding:18px!important}
  .tabs{background:#f2f5f3!important;border-radius:16px!important}.tab{font-size:11px!important}.tab.active{background:var(--v3-dark)!important;color:#fff!important;box-shadow:none!important}
  .video{border:0!important;border-radius:24px!important;box-shadow:none!important}.care{background:#fff!important;border:1px solid var(--v3-line)!important;box-shadow:0 14px 32px rgba(24,55,48,.12)!important}
  .talk{background:var(--v3-dark)!important;box-shadow:none!important}.toggle.on{background:var(--v3-soft)!important;border-color:#b8ddd5!important;color:#164b42!important}.cc-switch{background:#dbe3df!important}.toggle.on .cc-switch{background:#4cbda8!important}
  #controlNote{background:#f4f7f5!important;border-color:var(--v3-line)!important}.health{background:#eef6f3!important;border-color:#dcebe6!important}
  .pane{background:#f7f9f8!important;border-color:var(--v3-line)!important}.event,.record,.share{border-color:var(--v3-line)!important;box-shadow:none!important}

  .bottom{background:var(--v3-dark)!important;border:0!important;border-radius:24px!important;box-shadow:0 14px 36px rgba(12,35,30,.28)!important;padding:7px!important}
  .bottom button{color:#a9c1bb!important;font-size:9px!important}.bottom button b{font-size:17px!important}.bottom button:first-child{background:var(--v3-accent)!important;color:#173a33!important}.bottom button:active{background:rgba(255,255,255,.11)!important;color:#fff!important}

  .cc-box{border-color:var(--v3-line)!important;border-radius:20px!important;box-shadow:none!important}.cc-score{background:var(--v3-soft)!important}.cc-score b{color:#176b5d!important}.cc-task{border-color:var(--v3-line)!important;border-radius:14px!important}.cc-check{color:#176b5d!important}.cc-task.done .cc-check{background:var(--v3-dark)!important}

  @media(max-width:850px){
    .shell{padding:0 14px!important}.top{margin:0 -14px 18px!important;padding:0 16px!important;height:78px!important;border-radius:0 0 26px 26px!important}.layout{grid-template-columns:1fr!important}.sidebar{display:none!important}
    .head{min-height:110px!important;padding:19px 18px!important}.head h1{font-size:25px!important}.head:after{font-size:90px;left:16px}.head .btn.primary{min-height:44px!important}
    .summary{grid-template-columns:1fr 1fr!important;gap:10px!important}.sum{min-height:96px!important;padding:14px!important}.sum b{font-size:23px!important}
    .cams{grid-template-columns:1fr!important}.cover{height:210px!important}.detail{margin:12px 0 0!important;padding:12px!important}.bottom{display:grid!important;right:14px!important;left:14px!important}
    .top .account{display:none!important}.top .btn.danger{display:inline-flex!important}
  }
  @media(max-width:520px){
    body{font-size:13px!important}.shell{padding:0 12px!important}.top{margin:0 -12px 16px!important;padding:0 14px!important;height:72px!important}.top .logo{font-size:19px!important}.top .logo small{font-size:9px!important}
    .head{min-height:100px!important;padding:17px!important;border-radius:22px!important}.head h1{font-size:23px!important}.head .muted{font-size:10px!important}.head .btn.primary{width:44px!important;height:44px!important;min-height:44px!important;padding:0!important;font-size:0!important;border-radius:14px!important}.head .btn.primary:after{content:'＋';font-size:22px!important}
    .summary{gap:9px!important;margin-bottom:14px!important}.sum{min-height:92px!important;border-radius:18px!important;padding:13px!important}.sum:before{width:32px!important;height:32px!important;margin-bottom:7px!important}.sum small{font-size:9px!important}.sum b{font-size:21px!important}
    .card{border-radius:24px!important}.cover{height:196px!important;border-radius:24px 24px 0 0!important;padding:14px!important}.body{padding:14px!important}.actions{grid-template-columns:1fr 1fr!important}.actions .btn{min-height:46px!important;font-size:10px!important}.actions .btn.primary{grid-column:1/-1!important;grid-row:1!important;min-height:50px!important;font-size:12px!important}
    .detail{border-radius:22px!important;padding:9px!important}.controls{grid-template-columns:1fr 1fr!important}.bottom{right:10px!important;left:10px!important;bottom:max(8px,env(safe-area-inset-bottom))!important;border-radius:22px!important}.bottom button{min-height:50px!important}
  }
  `;
  document.head.appendChild(s);
  document.documentElement.dataset.camcamUi='viewer-v3';
  const head=document.querySelector('.head h1');if(head)head.textContent='پت‌های من';
  const sub=document.querySelector('.head .muted');if(sub)sub.textContent='وضعیت، مراقبت و ارتباط زنده در یک نگاه';
}
let careLoaded=false;
function loadCare(){
  if(careLoaded||window.__camcamPetCareV1){installRedesign();return}
  careLoaded=true;
  load('/static/pet_care_v1.js?rev='+rev,()=>setTimeout(installRedesign,0));
}
function afterBase(){let tries=0;const timer=setInterval(()=>{tries++;if(window.__camcamViewerRuntimeFinal||tries>=25){clearInterval(timer);loadCare()}},100);setTimeout(loadCare,3200)}
installFontNow();
load('/static/pet_controls_bundle.js?rev='+rev,afterBase);
setTimeout(()=>{loadCare();installRedesign()},4500);
window.__camcamPetBootV3=true;
})();
