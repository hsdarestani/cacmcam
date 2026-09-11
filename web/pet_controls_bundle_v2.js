(function(){
'use strict';
function load(src,done){const s=document.createElement('script');s.src=src;s.async=false;s.onload=()=>done&&done();s.onerror=()=>done&&done();document.head.appendChild(s)}
function loadCareWhenReady(){let tries=0;const timer=setInterval(()=>{tries++;if(window.__camcamViewerRuntimeFinal||tries>100){clearInterval(timer);load('/static/pet_care_v1.js?v=1')}},100)}
load('/static/pet_controls_bundle.js?v=14',loadCareWhenReady);
})();
