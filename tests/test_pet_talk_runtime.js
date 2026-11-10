// Regression test: viewer must never apply an SDP answer to a closed peer
// when the user taps Stop during asynchronous WebRTC negotiation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('web/pet_runtime.js','utf8');
const start=source.indexOf('// Tap-to-talk:');
const end=source.indexOf('// ---- Command channel',start);
assert(start>=0&&end>start,'talk runtime section must exist');
const talkCode=source.slice(start,end);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(predicate){
  for(let i=0;i<100;i++){if(predicate())return;await tick();}
  throw new Error('Timed out waiting for mock WebRTC signaling');
}

function harness(){
  let element,resolveWhip;
  const toasts=[],peers=[],deleted=[],streams=[];
  function button(){
    return {
      textContent:'',classList:{toggle(){}},setAttribute(){},
      addEventListener(name,callback){this[name]=callback},
      cloneNode(){return button()},
      parentNode:{replaceChild(next){element=next}}
    };
  }
  element=button();
  const document={
    getElementById(id){return id==='talk'?element:null},
    addEventListener(){},
  };
  function newPeer(){
    const peer={
      signalingState:'stable',connectionState:'connecting',
      addTrack(){},async createOffer(){return {type:'offer',sdp:'offer'}},
      async setLocalDescription(){this.localDescription={sdp:'offer'};this.signalingState='have-local-offer'},
      async setRemoteDescription(answer){
        this.applied=(this.applied||0)+1;
        if(this.signalingState==='closed')throw Object.assign(new Error('closed'),{name:'InvalidStateError'});
        assert.equal(answer.type,'answer');
        this.signalingState='stable';this.connectionState='connected';
      },
      close(){this.signalingState='closed';this.connectionState='closed'}
    };
    peers.push(peer);
    return peer;
  }
  const context=vm.createContext({
    document,newPeer,AbortController,setTimeout,clearTimeout,
    activeId:'device1',activeDevice:{access:'owner'},
    ccTalkHeld:false,ccTalkBusy:false,ccTalkGeneration:0,ccTalkAbort:null,
    talkPC:null,talkStream:null,talkResource:null,
    ccCancelled(){return Object.assign(new Error('cancelled'),{ccCancelled:true})},
    ccNativeMicPermission:async()=>true,
    ccPauseRemoteAudio(){},ccRestoreRemoteAudio(){},ccNativeRelease(){},
    ccAcquireMic:async()=>{
      const track={stopped:false,stop(){this.stopped=true}};
      const stream={getAudioTracks(){return [track]},getTracks(){return [track]}};
      streams.push(stream);return stream;
    },
    api:async url=>url.includes('talk-token')
      ?{whip_url:'/webrtc/talk/device1/whip',token:'token'}:{},
    waitIce:async()=>{},
    toast:msg=>toasts.push(msg),
    fetch:(url,opt)=>{
      if(opt.method==='DELETE'){deleted.push(url);return Promise.resolve({ok:true})}
      assert.equal(opt.method,'POST');
      return new Promise(resolve=>{resolveWhip=()=>resolve({
        ok:true,headers:{get:()=>'/webrtc/talk/device1/session1'},
        text:async()=>{await tick();return 'answer'}
      })});
    }
  });
  vm.runInContext(talkCode,context,{filename:'pet_talk_runtime_test.js'});
  return {context,peers,toasts,deleted,streams,element:()=>element,
    signalReady:()=>typeof resolveWhip==='function',answer:()=>resolveWhip()};
}

(async()=>{
  const cancelled=harness();
  const startPromise=cancelled.context.ccStartTalk({preventDefault(){}});
  await until(cancelled.signalReady);
  await cancelled.context.ccStartTalk({preventDefault(){}}); // user taps Stop
  cancelled.answer(); // server answer arrives after local close
  await startPromise;
  assert.equal(cancelled.peers[0].applied||0,0);
  assert.equal(cancelled.peers[0].signalingState,'closed');
  assert.equal(cancelled.toasts.length,0);
  assert.equal(cancelled.streams[0].getTracks()[0].stopped,true);
  assert.equal(cancelled.element().getAttribute?.('aria-pressed'),undefined);
  assert(cancelled.deleted.length>0,'stranded WHIP resource should be cleaned');

  const active=harness();
  const session=active.context.ccStartTalk({preventDefault(){}});
  await until(active.signalReady);
  active.answer();
  await session;
  assert.equal(active.peers[0].applied,1);
  assert.equal(active.context.ccTalkHeld,true);
  assert.match(active.element().textContent,/در حال صحبت/);
  await active.context.ccStartTalk({preventDefault(){}});
  assert.equal(active.peers[0].signalingState,'closed');
  assert.equal(active.context.ccTalkHeld,false);
  assert.equal(active.toasts.length,0);
  console.log('CamCam tap-to-talk lifecycle regressions passed');
})().catch(e=>{console.error(e);process.exitCode=1});
