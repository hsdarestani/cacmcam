(function(){
'use strict';
const rev=Date.now();
function load(src,done){const s=document.createElement('script');s.src=src;s.async=false;s.onload=()=>done&&done();s.onerror=()=>done&&done();document.head.appendChild(s)}
function installFontNow(){
  if(!document.getElementById('cc-estedad-camera-boot')){const l=document.createElement('link');l.id='cc-estedad-camera-boot';l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Estedad:wght@400;500;600;700;800&display=swap&v='+rev;document.head.appendChild(l)}
  if(!document.getElementById('cc-camera-font-boot-style')){const s=document.createElement('style');s.id='cc-camera-font-boot-style';s.textContent='body,button,input,select,textarea{font-family:"Estedad","Noto Sans Arabic","Noto Naskh Arabic",Tahoma,Arial,sans-serif!important}';document.head.appendChild(s)}
}
let companionLoaded=false;
function loadCompanion(){if(companionLoaded||window.__camcamCameraCompanionV1)return;companionLoaded=true;load('/static/pet_camera_companion_v1.js?rev='+rev)}
function afterBase(){let tries=0;const timer=setInterval(()=>{tries++;if(window.__camcamCameraRuntimeFinal||tries>=25){clearInterval(timer);loadCompanion()}},100);setTimeout(loadCompanion,3200)}
installFontNow();
load('/static/pet_camera_bundle.js?rev='+rev,afterBase);
setTimeout(loadCompanion,4500);
window.__camcamCameraBootV2=true;
})();
