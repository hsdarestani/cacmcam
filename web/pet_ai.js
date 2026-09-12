(()=>{
const E=s=>esc(s);
const style=document.createElement('style');style.textContent=`
.cc-ai-chat{display:grid;gap:10px;max-height:48vh;overflow:auto;padding:4px}.cc-ai-msg{padding:11px 13px;border-radius:15px;line-height:1.9;white-space:pre-wrap}.cc-ai-user{background:#e5f2ee;margin-right:12%}.cc-ai-bot{background:#f7f3ed;margin-left:12%}.cc-ai-form{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}.cc-ai-form textarea{resize:vertical;min-height:52px;border:1px solid var(--line);border-radius:13px;padding:10px;font:inherit}.cc-ai-note{font-size:11px;color:var(--muted);margin:8px 0}.cc-premium{background:linear-gradient(135deg,#173f38,#246b5d);color:#fff;border-radius:18px;padding:16px;line-height:1.9}.cc-premium .btn{margin-top:10px}
`;document.head.appendChild(style);

function ensureAI(){
 const tabs=document.querySelector('.detail .tabs');if(!tabs||document.getElementById('aiTab'))return;
 const button=document.createElement('button');button.className='tab';button.dataset.tab='ai';button.textContent='دستیار هوشمند';button.onclick=()=>showTab('ai');tabs.appendChild(button);
 const pane=document.createElement('div');pane.id='aiTab';pane.className='hidden';pane.innerHTML='<div class="pane"><b>از دستیار پت بپرس</b><div id="aiQuota" class="cc-ai-note">در حال دریافت سهمیه…</div><div id="aiChat" class="cc-ai-chat"><div class="cc-ai-msg cc-ai-bot">درباره مراقبت، برنامه روزانه یا اطلاعات ثبت‌شده پت سؤال کن.</div></div><form class="cc-ai-form" onsubmit="ccAskAI(event)"><textarea id="aiQuestion" maxlength="1200" required placeholder="مثلاً امروز غذای پت من ثبت شده؟"></textarea><button id="aiSend" class="btn primary">ارسال</button></form><div class="cc-ai-note">این دستیار جایگزین دامپزشک نیست.</div></div>';
 document.getElementById('detail').appendChild(pane);
}
const originalShow=window.showTab;
window.showTab=function(tab){ensureAI();if(tab==='ai'){
 ['live','events','archive','settings'].forEach(x=>document.getElementById(x+'Tab')?.classList.add('hidden'));
 document.getElementById('aiTab')?.classList.remove('hidden');document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='ai'));ccAIStatus();return;
 }document.getElementById('aiTab')?.classList.add('hidden');return originalShow(tab)};

window.ccAIStatus=async()=>{if(!activeId)return;try{const s=await api(`/api/pet/devices/${activeId}/ai/status`);const q=document.getElementById('aiQuota');q.textContent=s.enabled?`سهمیه امروز: ${s.remaining} از ${s.daily_limit} پرسش باقی مانده`:'برای استفاده، اشتراک پریمیوم را فعال کن';if(!s.configured)q.textContent+=' · سرویس Cloudflare هنوز تنظیم نشده';}catch(e){document.getElementById('aiQuota').textContent=e.message}};
window.ccAskAI=async e=>{e.preventDefault();const input=document.getElementById('aiQuestion'),button=document.getElementById('aiSend'),chat=document.getElementById('aiChat'),question=input.value.trim();if(!question)return;chat.insertAdjacentHTML('beforeend',`<div class="cc-ai-msg cc-ai-user">${E(question)}</div>`);input.value='';button.disabled=true;try{const r=await api(`/api/pet/devices/${activeId}/ai/ask`,{method:'POST',body:JSON.stringify({question})});chat.insertAdjacentHTML('beforeend',`<div class="cc-ai-msg cc-ai-bot">${E(r.answer)}</div>`);document.getElementById('aiQuota').textContent=`سهمیه امروز: ${r.remaining} از ${r.daily_limit} پرسش باقی مانده`;}catch(x){chat.insertAdjacentHTML('beforeend',`<div class="cc-ai-msg cc-ai-bot">${E(x.message)}</div>`)}finally{button.disabled=false;chat.scrollTop=chat.scrollHeight}};

window.ccPremium=()=>openModal('<button class="close" onclick="closeModal()">×</button><div class="cc-premium"><h3>CamCam Premium</h3><b style="font-size:24px">۱۹۹ هزار تومان / ماه</b><p>۷ روز اول رایگان؛ سپس همه قابلیت‌ها، تا ۱۰ دوربین، آرشیو ۳۰روزه و دستیار هوشمند فعال است.</p><button class="btn" onclick="ccCheckout()">فعال‌سازی پریمیوم</button></div>');
window.ccCheckout=async()=>{try{const r=await api('/api/billing/checkout',{method:'POST',body:JSON.stringify({plan_code:'premium_monthly'})});location.href=r.redirect_url}catch(e){toast(e.message)}};
const account=document.querySelector('.top .account');if(account){account.style.cursor='pointer';account.title='مشاهده اشتراک';account.onclick=ccPremium}
const planLabel=document.getElementById('plan');if(planLabel)new MutationObserver(()=>{const current=me?.entitlement?.plan;if(current==='premium'&&planLabel.textContent!=='پریمیوم')planLabel.textContent='پریمیوم';}).observe(planLabel,{childList:true});
ensureAI();
})();
