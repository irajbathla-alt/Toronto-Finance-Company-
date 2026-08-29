window.TFC_CONFIG={
  apiUrl:"https://script.google.com/macros/s/AKfycbxvkD5U6shFqseYlralB4VTQ_MbK42HbiPHXmZvAqgj1NXkwcMGkvkimcsYu2VNd7m-/exec",
  minimumStatements:6,
  demoMode:false,
  requestTimeout:30000,
  build:"20260828-adobesign-a4-viewport"
};

(function updateAdobeSignWidget(){
  if(!/client-dashboard\.html/i.test(location.pathname))return;
  const iframe=document.querySelector('#signPanel .adobe-wrap iframe');
  if(!iframe)return;
  const wrap=iframe.closest('.adobe-wrap');
  const panel=document.getElementById('signPanel');

  iframe.src='https://na4.documents.adobe.com/public/esignWidget?wid=CBFCIBAA3AAABLblqZhBgCTXn5u_TlQ7fvxZVQRsrOtRGUybq5Exlw8eHr4geWAx9Ptarkd-XwhkIlxmWwlk*&hosted=false';
  iframe.width='100%';
  iframe.height='100%';
  iframe.frameBorder='0';
  iframe.style.setProperty('border','0','important');
  iframe.style.setProperty('overflow','hidden','important');
  iframe.style.setProperty('width','100%','important');
  iframe.style.setProperty('height','100%','important');
  iframe.style.setProperty('min-height','0','important');
  iframe.style.setProperty('min-width','0','important');

  if(panel){
    panel.style.setProperty('width','min(840px, calc(100vw - 32px))','important');
    panel.style.setProperty('max-width','840px','important');
    panel.style.setProperty('margin-left','auto','important');
    panel.style.setProperty('margin-right','auto','important');
    panel.style.setProperty('transform','none','important');
  }
  if(wrap){
    wrap.style.setProperty('width','min(100%, 794px)','important');
    wrap.style.setProperty('max-width','794px','important');
    wrap.style.setProperty('aspect-ratio','210 / 297','important');
    wrap.style.setProperty('height','auto','important');
    wrap.style.setProperty('min-height','0','important');
    wrap.style.setProperty('margin-left','auto','important');
    wrap.style.setProperty('margin-right','auto','important');
  }

  if(!document.getElementById('tfc-a4-viewport-center')){
    const style=document.createElement('style');
    style.id='tfc-a4-viewport-center';
    style.textContent=`
      .panels:has(#signPanel.active){
        width:100vw!important;
        max-width:100vw!important;
        margin-left:calc(50% - 50vw)!important;
        margin-right:0!important;
        display:flex!important;
        justify-content:center!important;
      }
      .panels:has(#signPanel.active) #signPanel.active{
        flex:0 0 auto!important;
        width:min(840px,calc(100vw - 32px))!important;
        max-width:840px!important;
        margin-left:auto!important;
        margin-right:auto!important;
      }
    `;
    document.head.appendChild(style);
  }
})();

(function warmCrm(){
  if(!/(?:admin|client-dashboard)\.html/i.test(location.pathname))return;
  const url=window.TFC_CONFIG&&window.TFC_CONFIG.apiUrl;
  if(!url)return;
  const callback='tfc_warm_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  const script=document.createElement('script');
  let timer;
  function cleanup(){
    if(timer)clearTimeout(timer);
    try{delete window[callback]}catch(_){window[callback]=undefined}
    if(script.parentNode)script.parentNode.removeChild(script);
  }
  window[callback]=cleanup;
  script.onerror=cleanup;
  script.src=url+'?action=health&callback='+encodeURIComponent(callback)+'&_='+Date.now();
  timer=setTimeout(cleanup,12000);
  document.head.appendChild(script);
})();

(function hardenClientPortal(){
  setTimeout(()=>{
    if(!/client-dashboard\.html/i.test(location.pathname))return;
    if(typeof window.jsonp==='function'&&!window.jsonp.__tfcHardened){
      const original=window.jsonp;
      const wrapped=function(action,payload={},mode='direct',timeout=30000){
        return original(action,payload,mode,Math.max(Number(timeout)||0,30000));
      };
      wrapped.__tfcHardened=true;
      window.jsonp=wrapped;
    }
  },0);
})();

(function keepClientDecisionOpen(){
  if(!/client-dashboard\.html/i.test(location.pathname))return;
  const timer=setInterval(()=>{
    const proceed=document.getElementById('decisionProceed');
    const moreInfo=document.getElementById('decisionMoreInfo');
    const status=document.getElementById('decisionStatus');
    if(!proceed||!moreInfo)return;

    const sending=Boolean(status&&/^Sending your response/i.test(String(status.textContent||'').trim()));
    if(!sending){
      proceed.disabled=false;
      moreInfo.disabled=false;
    }

    if(status&&status.classList.contains('show')&&!sending&&/Your response has been sent:/i.test(status.textContent||'')){
      const current=String(status.textContent||'').replace(/\s*You can respond again.*$/i,'').trim();
      status.textContent=current+' You can respond again after reviewing any new advisor update.';
    }
  },350);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();

(function loadMotionSystem(){
  if(!document.querySelector('link[data-tfc-motion]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='motion.css?v=20260806-2';
    link.dataset.tfcMotion='true';
    document.head.appendChild(link);
  }
  if(!document.querySelector('script[data-tfc-motion]')){
    const script=document.createElement('script');
    script.src='motion.js?v=20260806-2';
    script.defer=true;
    script.dataset.tfcMotion='true';
    document.head.appendChild(script);
  }
})();