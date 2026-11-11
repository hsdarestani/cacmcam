// Regression coverage for the active CamCam Care portal talk button.
// A fast tap must never close a peer before its late WHIP answer is processed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('web/pet_portal.js','utf8');
const begin=source.indexOf('// ---- Portal talk lifecycle:');
const end=source.indexOf('window.portalManual=async',begin);
assert(begin>=0&&end>begin,'portal talk lifecycle section must exist');
const talkCode=source.slice(begin,end);
assert.match(source,/onclick="portalTalkToggle\(event\)"/,'Care button must use tap-to-talk');
assert.doesNotMatch(source,/onpointerup="portalTalkStop\(\)"/,'tap release must not close a negotiating peer');

const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(check){
  for(let i=0;i<100;i++){if(check())return;await tick()}
  throw new Error('Timed out waiting for WHIP signaling');
}
function harness(){
  const P={active:'device1',page:'camera',talk:null,talkStream:null,
    talkBusy:false,talkGeneration:0,talkAbort:null,talkResource:null,
    talkTimer:null,talkMutedBefore:null};
  const peers=[],streams=[],toasts=[],deleted=[];
  let resolveWhip;
  const video={muted:false};
  const button={textContent:'',attributes:{},classList:{toggle(_,active){button.active=active}},
    setAttribute(key,value){button.attributes[key]=value}};
  const q=id=>id==='pcTalk'?button:id==='liveVideo'?video:null;
  const context=vm.createContext({
    P,q,active:()=>({access:'owner'}),
    document:{hidden:false,addEventListener(){}},
    navigator:{mediaDevices:{}},AbortController,setTimeout,clearTimeout,
    ensureNativeMic:async()=>true,
    getMic:async()=>{
      const track={stopped:false,stop(){this.stopped=true}};
      const stream={getAudioTracks:()=>[track],getTracks:()=>[track]};
      streams.push(stream);return stream;
    },
    api:async path=>path.endsWith('/talk-token')
      ?{whip_url:'/webrtc/talk/device1/whip',token:'test'}:{},
    waitIce:async()=>{},
    newPeer:()=>{
      const peer={signalingState:'stable',connectionState:'connecting',remoteCalls:0,
        addTrack(){},createOffer:async()=>({type:'offer',sdp:'offer'}),
        async setLocalDescription(){this.localDescription={sdp:'offer'};this.signalingState='have-local-offer'},
        async setRemoteDescription(answer){
          this.remoteCalls++;
          if(this.signalingState==='closed')throw Object.assign(new Error('closed'),{name:'InvalidStateError'});
          assert.equal(answer.type,'answer');this.connectionState='connected';this.signalingState='stable';
        },
        close(){this.signalingState='closed';this.connectionState='closed'}
      };
      peers.push(peer);return peer;
    },
    fetch:(url,opts)=>{
      if(opts.method==='DELETE'){deleted.push(url);return Promise.resolve({ok:true})}
      assert.equal(opts.method,'POST');
      return new Promise(resolve=>{
        resolveWhip=()=>resolve({ok:true,status:201,
          headers:{get:()=>'/webrtc/talk/device1/resource1'},
          text:async()=>{await tick();return 'remote-sdp'}});
      });
    },
    toast:message=>toasts.push(message)
  });
  context.window=context;
  context.addEventListener=()=>{};
  vm.runInContext(talkCode,context,{filename:'portal_talk_lifecycle_test.js'});
  return{context,P,peers,streams,toasts,deleted,button,video,
    signalReady:()=>typeof resolveWhip==='function',
    answer:()=>resolveWhip()};
}
(async()=>{
  const cancelled=harness();
  const pending=cancelled.context.portalTalkToggle({preventDefault(){}});
  await until(cancelled.signalReady);
  cancelled.context.portalTalkToggle({preventDefault(){}}); // second tap cancels
  assert.equal(cancelled.peers[0].signalingState,'closed');
  cancelled.answer(); // late server answer for the closed peer
  await pending;
  assert.equal(cancelled.peers[0].remoteCalls,0,'no remote description on a closed peer');
  assert.equal(cancelled.toasts.length,0,'intentional cancellation must stay silent');
  assert.equal(cancelled.P.talk,null);
  assert.equal(cancelled.streams[0].getTracks()[0].stopped,true);
  assert.equal(cancelled.video.muted,false);
  assert(cancelled.deleted.includes('/webrtc/talk/device1/resource1'),'orphan WHIP resource must be deleted');

  const connected=harness();
  const negotiating=connected.context.portalTalkToggle({preventDefault(){}});
  await until(connected.signalReady);
  connected.answer();
  await negotiating;
  assert.equal(connected.peers[0].remoteCalls,1);
  assert.equal(connected.P.talk,connected.peers[0]);
  assert.match(connected.button.textContent,/در حال صحبت/);
  assert.equal(connected.button.attributes['aria-pressed'],'true');
  assert.equal(connected.video.muted,true);
  connected.context.portalTalkToggle({preventDefault(){}});
  assert.equal(connected.P.talk,null);
  assert.equal(connected.peers[0].signalingState,'closed');
  assert.equal(connected.streams[0].getTracks()[0].stopped,true);
  assert.equal(connected.video.muted,false);
  assert.equal(connected.toasts.length,0);
  assert(connected.deleted.length>0);

  const switched=harness();
  const switching=switched.context.portalTalkToggle({preventDefault(){}});
  await until(switched.signalReady);
  switched.context.portalTalkStop();
  switched.P.active='device2';switched.P.page='home';
  switched.answer();
  await switching;
  assert.equal(switched.peers[0].remoteCalls,0);
  assert.equal(switched.toasts.length,0);
  assert.equal(switched.P.talk,null);
  console.log('CamCam Care portal talk lifecycle regressions passed');
})().catch(error=>{console.error(error);process.exitCode=1});
