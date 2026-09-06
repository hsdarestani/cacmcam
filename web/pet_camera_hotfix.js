(function(){
'use strict';
const sleep2=ms=>new Promise(r=>setTimeout(r,ms));
async function hardRestartTorchOff(){
  try{const t=raw?.getVideoTracks?.()[0];if(t)t.stop()}catch{}
  torch=false;try{states()}catch{}
  try{await startCamera(true,false);return true}catch{return false}
}
setTorch=async function(on){
  const t=raw?.getVideoTracks?.()[0];if(!t)return{ok:false,message:'دوربین آماده نیست.'};
  if(on){try{const cap=t.getCapabilities?.();if(!cap?.torch)return{ok:false,message:'چراغ روی این دوربین از داخل اپ پشتیبانی نمی‌شود.'};await t.applyConstraints({advanced:[{torch:true}]});await sleep2(180);const s=t.getSettings?.();if(s&&Object.prototype.hasOwnProperty.call(s,'torch')&&s.torch!==true)return{ok:false,message:'گوشی فرمان روشن‌کردن چراغ را نپذیرفت.'};torch=true;states();try{await telemetry()}catch{}return{ok:true,message:'چراغ روشن شد.'}}catch{return{ok:false,message:'چراغ روشن نشد.'}}}
  try{await t.applyConstraints({advanced:[{torch:false}]});await sleep2(180);const s=t.getSettings?.();if(s&&Object.prototype.hasOwnProperty.call(s,'torch')&&s.torch===false){torch=false;states();try{await telemetry()}catch{}return{ok:true,message:'چراغ خاموش شد.'}}}catch{}
  const restarted=await hardRestartTorchOff();try{await telemetry()}catch{}return restarted?{ok:true,message:'چراغ خاموش شد و دوربین برای اطمینان دوباره متصل شد.'}:{ok:false,message:'خاموش‌کردن چراغ انجام نشد؛ دوربین را یک‌بار عوض کن.'};
};
const AUDIO={'بیا پیشم':'/static/audio/bia-pisham.ogg','نه عزیزم':'/static/audio/na-azizam.ogg','غذات آماده‌ست':'/static/audio/ghazat-amadast.ogg'};
const oldSay=say;let phraseAudio=null;
say=function(text){
  text=String(text||'').trim();if(!text)return false;const src=AUDIO[text],mic=raw?.getAudioTracks?.()[0],was=mic?.enabled;if(mic)mic.enabled=false;const restore=()=>{if(mic&&was!==undefined)mic.enabled=was};
  if(src){try{if(phraseAudio){phraseAudio.pause();phraseAudio.src=''}phraseAudio=new Audio(src+'?v=3');phraseAudio.volume=1;phraseAudio.preload='auto';phraseAudio.addEventListener('ended',restore,{once:true});phraseAudio.addEventListener('error',()=>{restore();try{oldSay(text)}catch{}},{once:true});phraseAudio.play().catch(()=>{restore();try{oldSay(text)}catch{}});setTimeout(restore,5500);return true}catch{restore()}}
  try{const ok=oldSay(text);setTimeout(restore,4500);return !!ok}catch{restore();return false}
};
const oldTelemetry=telemetry;telemetry=async function(){try{await oldTelemetry()}finally{try{const info={};if(window.CamCamNative?.getBatteryInfo)Object.assign(info,JSON.parse(window.CamCamNative.getBatteryInfo()));await req('/api/pet/device/telemetry',{method:'POST',headers:hdr(),body:JSON.stringify({...info,low_power:lowPower,torch:!!torch,codec:window.codec||null,facing,quality:settings.quality,zoom:Number(zoom)||1,talk_connected:talkPc?.connectionState==='connected'})})}catch{}}};
})();
