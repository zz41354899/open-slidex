/** Adds the runtime-only page bridge without mutating the canonical HTML asset. */
export function injectHtmlPlaybackBridge(source: string) {
  if (source.includes("data-open-slidex-playback-bridge")) return source;
  const bridge = htmlPlaybackBridge(htmlPlaybackNonce(source));
  const marker = source.match(/<\/body\s*>/i);
  if (!marker?.index) return `${source}\n${bridge}`;
  return `${source.slice(0, marker.index)}${bridge}\n${source.slice(marker.index)}`;
}

function htmlPlaybackBridge(nonce: string) {
  const nonceAttribute = nonce ? ` nonce="${escapeAttribute(nonce)}"` : "";
  return `<script data-open-slidex-playback-bridge${nonceAttribute}>(function(){
  var TYPE='open-slidex:html-page';
  var nativeReplace=history.replaceState.bind(history);
  var bridgeScript=document.currentScript;
  var motionStyle=document.createElement('style');
  motionStyle.setAttribute('data-open-slidex-motion-governor','');
  if(bridgeScript&&bridgeScript.nonce)motionStyle.nonce=bridgeScript.nonce;
  motionStyle.textContent='[aria-hidden="true"] *,[data-on="0"] *{animation-play-state:paused!important}';
  var nativeSlides=[].slice.call(document.querySelectorAll('[data-slidex-slide-index]'));
  if(nativeSlides.length){
    document.documentElement.setAttribute('data-open-slidex-native-projection','');
    motionStyle.textContent+='html[data-open-slidex-native-projection],html[data-open-slidex-native-projection] body{height:100%;min-height:0;overflow:hidden}html[data-open-slidex-native-projection] .player{height:100%;min-height:0;width:100%}html[data-open-slidex-native-projection] .stage{height:100%;min-height:0;padding:0;width:100%}html[data-open-slidex-native-projection] .viewport{border-radius:0!important;box-shadow:none!important;height:100%!important;width:100%!important}html[data-open-slidex-native-projection] .controls,html[data-open-slidex-native-projection] .slide-dots{display:none!important}';
  }
  (document.head||document.documentElement).appendChild(motionStyle);
  function syncMotionActivity(){
    [].slice.call(document.querySelectorAll('svg')).forEach(function(svg){
      if(typeof svg.pauseAnimations!=='function')return;
      try{if(svg.closest('[aria-hidden="true"],[data-on="0"]'))svg.pauseAnimations();else if(typeof svg.unpauseAnimations==='function')svg.unpauseAnimations()}catch(e){}
    });
  }
  function currentPage(){
    var active=document.querySelector('[data-slidex-slide-index].is-active');
    var nativeIndex=active?+(active.getAttribute('data-slidex-slide-index')||0):NaN;
    if(Number.isInteger(nativeIndex)&&nativeIndex>=0)return nativeIndex+1;
    var explicit=[].slice.call(document.querySelectorAll('[data-slidex-page],.gcard.page')).filter(function(node){return node!==document.documentElement});
    var visible=explicit.find(function(node){return node.getAttribute('data-on')==='1'||node.classList.contains('active')});
    if(visible){
      var value=+(visible.getAttribute('data-slidex-page')||visible.getAttribute('data-page')||explicit.indexOf(visible)+1);
      if(Number.isInteger(value)&&value>0)return value;
    }
    var m=/^#p?(\\d+)$/.exec(location.hash);return m?Math.max(1,+m[1]||1):1;
  }
  function report(){parent.postMessage({type:'open-slidex:html-page-change',page:currentPage()},'*')}
  history.replaceState=function(){nativeReplace.apply(history,arguments);report()};
  function nativeProjectionPage(page){
    if(!nativeSlides.length)return false;
    var index=page-1;
    var target=nativeSlides.find(function(node){return +(node.getAttribute('data-slidex-slide-index')||0)===index});
    if(!target)return false;
    var dot=document.querySelector('[data-slide-target="'+index+'"]');
    if(dot&&typeof dot.click==='function')dot.click();
    else nativeSlides.forEach(function(node){node.classList.toggle('is-active',node===target);node.classList.remove('is-leaving')});
    document.documentElement.setAttribute('data-slidex-page',String(page));
    return true;
  }
  function explicitPage(page){
    var nodes=[].slice.call(document.querySelectorAll('[data-slidex-page],.gcard.page')).filter(function(node,index,list){return node!==document.documentElement&&list.indexOf(node)===index});
    if(!nodes.length)return nativeProjectionPage(page);
    nodes.forEach(function(node,index){
      var value=+(node.getAttribute('data-slidex-page')||node.getAttribute('data-page')||index+1);
      var active=value===page;
      node.setAttribute('data-on',active?'1':'0');
      node.setAttribute('aria-hidden',active?'false':'true');
      if(node.matches('.gcard.page'))node.classList.toggle('active',active);
    });
    document.documentElement.setAttribute('data-slidex-page',String(page));
    return true;
  }
  function navigate(page){
    page=Math.max(1,Math.floor(+page||1));
    var oldURL=location.href;
    var hash=/^#\\d+$/.test(location.hash)?'#'+page:'#p'+page;
    explicitPage(page);
    if(location.hash!==hash)nativeReplace(null,'',hash);
    window.dispatchEvent(new HashChangeEvent('hashchange',{oldURL:oldURL,newURL:location.href}));
    syncMotionActivity();
    report();
  }
  function replay(page){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    window.dispatchEvent(new CustomEvent('open-slidex:replay',{detail:{page:page}}));
    var card=document.querySelector('.gleft .gcard[data-on="1"],[data-slidex-page][data-on="1"]');
    var stage=card?+(card.getAttribute('data-stage')||4):4;
    if(window.IDATree&&typeof window.IDATree.apply==='function'){
      if(typeof window.IDATree.stop==='function')window.IDATree.stop();
      window.IDATree.apply(0);
      requestAnimationFrame(function(){requestAnimationFrame(function(){window.IDATree.apply(stage)})});
    }
    [].slice.call(document.querySelectorAll('svg')).forEach(function(svg){
      if(svg.closest('[aria-hidden="true"],[data-on="0"]'))return;
      if(typeof svg.setCurrentTime==='function'){try{svg.setCurrentTime(0);svg.unpauseAnimations&&svg.unpauseAnimations()}catch(e){}}
    });
    syncMotionActivity();
  }
  function emitKeyboard(intent){parent.postMessage({type:'open-slidex:html-canvas-keyboard',intent:intent},'*')}
  function typingTarget(target){return !!(target&&target.closest&&target.closest('input,select,textarea,[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]'))}
  function isSpace(event){return event.code==='Space'||event.key===' '||event.key==='Spacebar'}
  function zoomCommand(event){
    if((!event.metaKey&&!event.ctrlKey)||event.altKey)return '';
    if(event.key==='+'||event.key==='='||event.key==='Add')return 'in';
    if(event.key==='-'||event.key==='_'||event.key==='Subtract')return 'out';
    return event.key==='0'?'fit':'';
  }
  function toolCommand(event){
    if(event.metaKey||event.ctrlKey||event.altKey)return '';
    var key=String(event.key||'').toLowerCase();
    return key==='v'?'select':key==='h'?'hand':key==='z'?'zoom':'';
  }
  function clamp(value,min,max){return Math.min(Math.max(value,min),max)}
  addEventListener('keydown',function(event){
    if(typingTarget(event.target))return;
    if(isSpace(event)){
      event.preventDefault();event.stopImmediatePropagation();
      emitKeyboard({kind:'temporary-hand',active:true});return;
    }
    var command=zoomCommand(event);
    if(command){event.preventDefault();event.stopImmediatePropagation();emitKeyboard({kind:'zoom',command:command});return}
    var tool=toolCommand(event);
    if(tool){event.preventDefault();event.stopImmediatePropagation();emitKeyboard({kind:'tool',tool:tool})}
  },true);
  addEventListener('keyup',function(event){
    if(isSpace(event)){event.preventDefault();event.stopImmediatePropagation();emitKeyboard({kind:'temporary-hand',active:false})}
  },true);
  addEventListener('wheel',function(event){
    if((!event.metaKey&&!event.ctrlKey)||typingTarget(event.target))return;
    event.preventDefault();event.stopImmediatePropagation();
    var width=Math.max(document.documentElement.clientWidth,innerWidth,1),height=Math.max(document.documentElement.clientHeight,innerHeight,1);
    emitKeyboard({kind:'wheel-zoom',deltaY:event.deltaY,deltaMode:event.deltaMode,xRatio:clamp(event.clientX/width,0,1),yRatio:clamp(event.clientY/height,0,1)});
  },{capture:true,passive:false});
  addEventListener('blur',function(){emitKeyboard({kind:'temporary-hand',active:false})});
  addEventListener('message',function(event){
    if(event.source!==parent||!event.data||event.data.type!==TYPE)return;
    navigate(event.data.page);
    if(event.data.replay)replay(event.data.page);
  });
  addEventListener('hashchange',report);
  if(nativeSlides.length){
    new MutationObserver(function(records){if(records.some(function(record){return record.attributeName==='class'}))report()}).observe(document.body||document.documentElement,{attributeFilter:['class'],attributes:true,subtree:true});
    requestAnimationFrame(function(){dispatchEvent(new Event('resize'));report()});
  }
  syncMotionActivity();
  parent.postMessage({type:'open-slidex:html-ready',page:currentPage()},'*');
})();</script>`;
}

function htmlPlaybackNonce(source: string) {
  const match = source.match(/<script\b[^>]*\snonce\s*=\s*(?:(['"])(.*?)\1|([^\s"'=<>`]+))/i);
  const nonce = (match?.[2] ?? match?.[3] ?? "").trim();
  return nonce && nonce.length <= 256 && !/[\s"'<>`]/.test(nonce) ? nonce : "";
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
