(function(){
'use strict';
const sleep2=ms=>new Promise(r=>setTimeout(r,ms));

async function publishTruth(){try{await telemetry()}catch{}}

async function hardReleaseTorchOff(){
  clearTimeout(retryTimer);
  try{if(pc)pc.close()}catch{}
  pc=null;
  clearInterval(drawTimer);drawTimer=null;
  try{if(out&&out!==raw)out.getTracks().forEach(t=>t.stop())}catch{}
  try{if(raw)raw.getTracks().forEach(t=>t.stop())}catch{}
  out=null;raw=null;
  try{$('preview').srcObject=null}catch{}
  await sleep2(420);
  let nativeResult=false;
  try{if(window.CamCamNative?.forceTorchOff)nativeResult=!!window.CamCamNative.forceTorchOff()}catch{}
  await sleep2(140);
  torch=false;
  try{states()}catch{}
  await publishTruth();
  setTimeout(()=>{try{if(creds&&!manualStop)startCamera(true,false)}catch{}},120);
  return nativeResult;
}

setTorch=async function(on){
  const t=raw?.getVideoTracks?.()[0];
  if(!t)return{ok:false,message:'دوربین آماده نیست.'};
  if(on){
    try{
      const cap=t.getCapabilities?.();
      if(!cap?.torch)return{ok:false,message:'چراغ روی این دوربین از داخل اپ پشتیبانی نمی‌شود.'};
      await t.applyConstraints({advanced:[{torch:true}]});
      await sleep2(180);
      const s=t.getSettings?.();
      if(s&&Object.prototype.hasOwnProperty.call(s,'torch')&&s.torch!==true)return{ok:false,message:'گوشی فرمان روشن‌کردن چراغ را نپذیرفت.'};
      torch=true;states();await publishTruth();
      return{ok:true,message:'چراغ روشن شد.'};
    }catch{return{ok:false,message:'چراغ روشن نشد.'}}
  }

  try{
    await t.applyConstraints({advanced:[{torch:false}]});
    await sleep2(220);
    const s=t.getSettings?.();
    if(!s||!Object.prototype.hasOwnProperty.call(s,'torch')||s.torch===false){
      torch=false;states();await publishTruth();
      return{ok:true,message:'چراغ خاموش شد.'};
    }
  }catch{}

  await hardReleaseTorchOff();
  return{ok:true,message:'چراغ خاموش شد؛ دوربین برای آزاد کردن کامل فلش در حال اتصال مجدد است.'};
};

// 1.4.0 used to clear KEEP_SCREEN_ON when low-power was enabled. That could
// suspend the WebView and prevent the remote OFF command from ever arriving.
// Old builds now use the black overlay only; 1.4.1+ also dims natively while
// keeping the camera command loop alive.
setLowPower=async function(on){
  lowPower=!!on;
  try{$('low').classList.toggle('show',lowPower)}catch{}
  try{
    const version=window.CamCamNative?.getRuntimeVersion?.();
    if(version&&version!=='1.4.0')window.CamCamNative.setLowPower(lowPower);
    else if(!lowPower)window.CamCamNative?.setLowPower?.(false);
  }catch{}
  await publishTruth();
};

const AUDIO={'بیا پیشم':'/static/audio/bia-pisham.ogg','نه عزیزم':'/static/audio/na-azizam.ogg','غذات آماده‌ست':'/static/audio/ghazat-amadast.ogg'};
const oldSay=say;let phraseAudio=null;
say=function(text){
  text=String(text||'').trim();if(!text)return false;const src=AUDIO[text],mic=raw?.getAudioTracks?.()[0],was=mic?.enabled;if(mic)mic.enabled=false;const restore=()=>{if(mic&&was!==undefined)mic.enabled=was};
  if(src){try{if(phraseAudio){phraseAudio.pause();phraseAudio.src=''}phraseAudio=new Audio(src+'?v=4');phraseAudio.volume=1;phraseAudio.preload='auto';phraseAudio.addEventListener('ended',restore,{once:true});phraseAudio.addEventListener('error',()=>{restore();try{oldSay(text)}catch{}},{once:true});phraseAudio.play().catch(()=>{restore();try{oldSay(text)}catch{}});setTimeout(restore,5500);return true}catch{restore()}}
  try{const ok=oldSay(text);setTimeout(restore,4500);return !!ok}catch{restore();return false}
};

const oldTelemetry=telemetry;
telemetry=async function(){
  try{await oldTelemetry()}finally{
    try{
      const info={};
      if(window.CamCamNative?.getBatteryInfo)Object.assign(info,JSON.parse(window.CamCamNative.getBatteryInfo()));
      await req('/api/pet/device/telemetry',{method:'POST',headers:hdr(),body:JSON.stringify({...info,low_power:!!lowPower,torch:!!torch,codec:window.codec||null,facing,quality:settings.quality,zoom:Number(zoom)||1,talk_connected:talkPc?.connectionState==='connected'})});
    }catch{}
  }
};
})();
