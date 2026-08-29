window.TFC_CONFIG={
  apiUrl:"https://script.google.com/macros/s/AKfycbxvkD5U6shFqseYlralB4VTQ_MbK42HbiPHXmZvAqgj1NXkwcMGkvkimcsYu2VNd7m-/exec",
  minimumStatements:6,
  demoMode:false,
  requestTimeout:30000,
  build:"20260828-adobesign3"
};

(function updateAdobeSignWidget(){
  if(!/client-dashboard\.html/i.test(location.pathname))return;
  const iframe=document.querySelector('#signPanel .adobe-wrap iframe');
  if(!iframe)return;
  iframe.src='https://na4.documents.adobe.com/public/esignWidget?wid=CBFCIBAA3AAABLblqZhBgCTXn5u_TlQ7fvxZVQRsrOtRGUybq5Exlw8eHr4geWAx9Ptarkd-XwhkIlxmWwlk*&hosted=false';
  iframe.width='100%';
  iframe.height='100%';
  iframe.frameBorder='0';
  iframe.style.border='0';
  iframe.style.overflow='hidden';
  iframe.style.minHeight='100%';
  iframe.style.minWidth='600px';

  if(!document.getElementById('tfc-adobe-fullscreen-style')){
    const style=document.createElement('style');
    style.id='tfc-adobe-fullscreen-style';
    style.textContent=`
      #signPanel.active{
        width:calc(100vw - 24px)!important;
        max-width:none!important;
        margin-left:calc(50% - 50vw + 12px)!important;
        border-radius:0!important;
        padding:18px clamp(12px,2vw,28px) 26px!important;
      }
      #signPanel .adobe-wrap{
        width:100%!important;
        height:calc(100vh - 185px)!important;
        min-height:720px!important;
        border-radius:0!important;
        overflow:auto!important;
        -webkit-overflow-scrolling:touch;
      }
      #signPanel .adobe-wrap iframe{
        display:block!important;
        width:100%!important;
        height:100%!important;
        min-height:100%!important;
        border:0!important;
      }
      @media(max-width:780px){
        #signPanel.active{
          width:100vw!important;
          margin-left:calc(50% - 50vw)!important;
          padding:12px 8px 20px!important;
        }
        #signPanel .adobe-wrap{
          height:calc(100vh - 145px)!important;
          min-height:650px!important;
        }
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