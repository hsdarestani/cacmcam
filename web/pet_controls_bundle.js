(function(){
'use strict';
function load(src,done){const s=document.createElement('script');s.src=src;s.async=false;s.onload=()=>done&&done();s.onerror=()=>done&&done();document.head.appendChild(s)}
load('/static/pet_controls_visual.js?v=5',()=>load('/static/pet_runtime_fix.js?v=5'));
})();
