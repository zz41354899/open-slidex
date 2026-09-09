const labels = {
 en: {title:"Phone remote",connecting:"Connecting…",connected:"Connected",reconnecting:"Reconnecting…",expired:"Session ended. Scan a new QR code.",denied:"Scan the QR code to connect.",failed:"Command failed. Try again.",slide:"Slide",previous:"Previous",next:"Next",timer:"Pomodoro",elapsed:"Elapsed",focus:"Focus",break:"Break",ready:"Ready",paused:"Paused",complete:"Complete",start:"Start",pause:"Pause",resume:"Resume",reset:"Reset",settings:"Timer settings",focusMinutes:"Focus · minutes",breakMinutes:"Break · minutes",apply:"Apply timer",cancel:"Cancel",hint:"Slides and timer sync with your computer.",language:"Language",nextPhase:"Start next section"},
 "zh-TW": {title:"手機遙控",connecting:"連線中…",connected:"已連線",reconnecting:"重新連線中…",expired:"連線已結束，請重新掃描 QR code。",denied:"請掃描 QR code 連線。",failed:"指令未送出，請重試。",slide:"投影片",previous:"上一張",next:"下一張",timer:"番茄鐘",elapsed:"已進行",focus:"專注",break:"休息",ready:"準備開始",paused:"已暫停",complete:"已完成",start:"開始",pause:"暫停",resume:"繼續",reset:"重設",settings:"計時設定",focusMinutes:"專注 · 分鐘",breakMinutes:"休息 · 分鐘",apply:"套用計時",cancel:"取消",hint:"投影片與計時會同步顯示於電腦。",language:"語言",nextPhase:"開始下一階段"}
};
export function presenterRemotePage(id: string, locale: "en" | "zh-TW" = "zh-TW") {
 return String.raw`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="dark"><title>SlideX Remote</title><style>
:root{color-scheme:dark;font-family:Inter,-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif;background:#202020;color:#eee}*{box-sizing:border-box}body{margin:0}button,input,select{font:inherit}button{cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}button:disabled{opacity:.32;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #c4b5fd;outline-offset:3px}
.remote{width:100%;max-width:460px;min-height:100dvh;margin:auto;padding:max(24px,env(safe-area-inset-top)) 24px max(20px,env(safe-area-inset-bottom));display:flex;flex-direction:column}
header{display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:13px}h1{font-size:14px;font-weight:600;margin:0}header b{color:#c4b5fd}.status{display:flex;align-items:center;gap:7px;font-size:11px;color:#999}.dot{width:6px;height:6px;border-radius:50%;background:#777}body.online .dot{background:#93c9a6}
.position{text-align:center;padding:38px 0 26px}.eyebrow{font-size:12px;color:#999}.number{font-size:58px;line-height:1.2;letter-spacing:-3px;font-weight:500;font-variant-numeric:tabular-nums;margin-top:8px}.number small{font-size:20px;letter-spacing:0;color:#777;margin-left:8px}
.clicker{display:grid;grid-template-columns:1fr 1.5fr;gap:12px;min-height:150px;flex:1;max-height:230px}.clicker button{border:1px solid #ffffff13;border-radius:20px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:14px;background:#2c2c2c;color:#ccc;font-size:13px;font-weight:500;transition:transform .1s,background .1s}.clicker button.next{background:#c3b6e7;color:#272033;border-color:transparent}.clicker svg{width:40px;height:40px;stroke:currentColor;fill:none;stroke-width:1.5}.clicker button:active:not(:disabled){transform:scale(.97)}
.timer{margin-top:30px;border-top:1px solid #ffffff12;padding-top:24px}.timer-top{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#aaa}.icon-button{height:40px;min-width:40px;border:1px solid #ffffff15;border-radius:10px;background:transparent;color:#bbb;padding:0 12px;font-size:12px}.clock{font-size:46px;line-height:1.2;font-variant-numeric:tabular-nums;letter-spacing:-1.5px;margin:8px 0}.meta{font-size:12px;color:#888;display:flex;justify-content:space-between;gap:8px}.actions{display:flex;gap:10px;margin-top:22px}.actions button{border:1px solid #ffffff15;border-radius:12px;height:48px;background:#2c2c2c;color:#ddd;padding:0 20px}.actions .primary{flex:1;background:#e4e1e9;color:#222;font-weight:600;border:0}
footer{display:flex;justify-content:space-between;align-items:center;gap:14px;padding-top:24px;margin-top:auto;color:#777;font-size:10px;line-height:1.6}select{background:transparent;color:#aaa;border:0;padding:8px 0;font-size:11px}.error{font-size:12px;color:#e4c598;line-height:1.5;margin:16px 0 0}.error:empty{display:none}
dialog{width:calc(100% - 32px);max-width:400px;border:1px solid #ffffff1a;border-radius:20px;background:#292929;color:#eee;padding:24px;box-shadow:0 20px 80px #0006}dialog::backdrop{background:#0009}h2{font-size:16px;margin:0 0 24px}label.field{display:flex;align-items:center;justify-content:space-between;font-size:13px;color:#bbb;margin:16px 0}input{width:80px;height:48px;border:1px solid #ffffff20;border-radius:10px;background:#1e1e1e;color:#eee;padding:8px;text-align:center;font-variant-numeric:tabular-nums}
@media(max-height:700px){.position{padding:20px 0}.clicker{min-height:120px}.timer{margin-top:20px;padding-top:14px}footer{padding-top:16px}.clock{font-size:38px}}
</style></head><body><main class="remote">
<header><h1>Slide<b>X</b> <span data-i18n="title"></span></h1><span class="status" role="status"><i class="dot"></i><span id="status"></span></span></header>
<section class="position"><div class="eyebrow" data-i18n="slide"></div><div class="number"><span id="count">—</span><small id="total">/ —</small></div></section>
<nav class="clicker"><button id="previous" disabled><svg aria-hidden="true" viewBox="0 0 40 40"><path d="m24 10-10 10 10 10"/></svg><span data-i18n="previous"></span></button><button class="next" id="next" disabled><svg aria-hidden="true" viewBox="0 0 40 40"><path d="m16 10 10 10-10 10"/></svg><span data-i18n="next"></span></button></nav>
<section class="timer"><div class="timer-top"><span data-i18n="timer"></span><button class="icon-button" id="settings-toggle" data-i18n="settings" disabled></button></div><div id="clock" class="clock">10:00</div><div class="meta"><span id="phase"></span><span><span data-i18n="elapsed"></span> <span id="elapsed">00:00</span></span></div><div class="actions"><button id="timer-reset" data-i18n="reset" disabled></button><button class="primary" id="timer-toggle" data-i18n="start" disabled></button></div></section>
<p class="error" id="error" role="alert"></p><footer><span data-i18n="hint"></span><select id="language" aria-label="Language"><option value="zh-TW">繁體中文</option><option value="en">English</option></select></footer></main>
<dialog id="settings"><form id="timer-form"><h2 data-i18n="settings"></h2><label class="field"><span data-i18n="focusMinutes"></span><input id="focus" type="number" min="1" max="120" step="1" value="10" required></label><label class="field"><span data-i18n="breakMinutes"></span><input id="break" type="number" min="0" max="120" step="1" value="2" required></label><p class="error" id="settings-error" role="alert"></p><div class="actions"><button id="cancel-settings" type="button" data-i18n="cancel"></button><button class="primary" type="submit" data-i18n="apply"></button></div></form></dialog>
<script>
const id=${JSON.stringify(id)},dictionaries=${JSON.stringify(labels)};
let locale=${JSON.stringify(locale)},state=null,online=false,terminal=false,statusKey='connecting',timerAnchor=performance.now(),retryDelay=500;
const token=location.hash.slice(1),q=s=>document.querySelector(s),tr=key=>dictionaries[locale][key];
const clock=v=>String(Math.floor(Math.max(0,v)/60)).padStart(2,'0')+':'+String(Math.max(0,v)%60).padStart(2,'0');
function updateLanguage(){document.documentElement.lang=locale;document.title='SlideX · '+tr('title');document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=tr(el.dataset.i18n));q('#language').value=locale;q('#language').ariaLabel=tr('language');render()}
function render(){
 q('#status').textContent=tr(statusKey);document.body.classList.toggle('online',online);
 const slideIndex=pendingSlide===null?state?.currentSlideIndex:pendingSlide;
 q('#previous').disabled=!online||!state||slideIndex===0;q('#next').disabled=!online||!state||slideIndex>=state.slideCount-1;
 ['#timer-toggle','#timer-reset','#settings-toggle'].forEach(s=>q(s).disabled=!online);
 if(!state){q('#phase').textContent=tr('ready');return}
 q('#count').textContent=slideIndex+1;q('#total').textContent='/ '+state.slideCount;
 const t=state.timer,delta=t.isRunning&&online?Math.min(t.remainingSeconds,Math.floor((performance.now()-timerAnchor)/1000)):0;
 q('#clock').textContent=clock(t.remainingSeconds-delta);q('#elapsed').textContent=clock(t.elapsedSeconds+delta);
 q('#phase').textContent=t.remainingSeconds===0?tr('complete'):t.phase==='ready'?tr('ready'):tr(t.phase)+(t.isRunning?'':' · '+tr('paused'));
 q('#timer-toggle').textContent=tr(t.isRunning?'pause':t.remainingSeconds===0?'nextPhase':t.phase==='ready'?'start':'resume');
}
let commandQueue=Promise.resolve(),slideSequence=0,pendingSlide=null;
const clientId=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
function acceptState(next){if(!state||next.slideRevision>=state.slideRevision){state=next;timerAnchor=performance.now()}render()}
async function send(body){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
 try{
  if(!online)throw Error('offline');
  const response=await fetch('/presenter/'+id+'/command',{method:'POST',signal:controller.signal,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw Error(String(response.status));
  if(response.status===200)acceptState(await response.json());
  q('#error').textContent='';
 }finally{clearTimeout(timeout)}
}
function slide(direction){
 if(!online||!state)return;
 const index=Math.max(0,Math.min(state.slideCount-1,(pendingSlide===null?state.currentSlideIndex:pendingSlide)+direction));
 const sequence=++slideSequence;pendingSlide=index;render();
 // No network waterfall: every tap is sent immediately with an ordered target.
 void send({type:'slide',index,clientId,sequence}).catch(()=>{q('#error').textContent=tr('failed')}).finally(()=>{if(sequence===slideSequence){pendingSlide=null;render()}});
}
function command(body){
 const task=commandQueue.then(()=>send(body));
 commandQueue=task.catch(()=>{q('#error').textContent=tr('failed')});return task;
}
q('#previous').onclick=()=>slide(-1);
q('#next').onclick=()=>slide(1);
q('#timer-toggle').onclick=()=>command({type:'timer.toggle'}).catch(()=>{});
q('#timer-reset').onclick=()=>command({type:'timer.reset'}).catch(()=>{});
q('#settings-toggle').onclick=()=>{q('#focus').value=state.timer.focusMinutes;q('#break').value=state.timer.breakMinutes;q('#settings-error').textContent='';q('#settings').showModal()};
q('#cancel-settings').onclick=()=>q('#settings').close();
q('#timer-form').onsubmit=async event=>{
 event.preventDefault();const focusMinutes=Number(q('#focus').value),breakMinutes=Number(q('#break').value);
 try{await command({type:'timer.configure',focusMinutes,breakMinutes});q('#settings').close()}catch{q('#settings-error').textContent=tr('failed')}
};
q('#language').onchange=event=>{locale=event.target.value;updateLanguage()};
async function connect(){
 if(terminal)return;if(!token){terminal=true;statusKey='denied';render();return}
 let reader;
 try{
  const response=await fetch('/presenter/'+id+'/events',{headers:{authorization:'Bearer '+token}});
  if(response.status===403||response.status===410){terminal=true;statusKey=response.status===410?'expired':'denied';render();return}
  if(!response.ok||!response.body)throw Error('stream');
  reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';
  for(;;){const chunk=await reader.read();if(chunk.done)throw Error('closed');buffer+=decoder.decode(chunk.value,{stream:true});
   const events=buffer.split('\n\n');buffer=events.pop()||'';
   for(const event of events){const line=event.split('\n').find(value=>value.startsWith('data: '));if(line){online=true;statusKey='connected';retryDelay=500;acceptState(JSON.parse(line.slice(6)))}}
  }
 }catch{online=false;statusKey='reconnecting';render();if(!terminal){setTimeout(connect,retryDelay);retryDelay=Math.min(5000,retryDelay*2)}}
 finally{if(reader)await reader.cancel().catch(()=>{})}
}
updateLanguage();connect();setInterval(render,250);
</script></body></html>`;
}
