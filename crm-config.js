window.TFC_CONFIG={
  apiUrl:"https://script.google.com/macros/s/AKfycbwsvfl21rZo5Cn2FGdcn9JqqMvz5XWegU8_CrGqOPnJirAGV7XUH-p9kfWCqJnuPTL9/exec",
  minimumStatements:6,
  demoMode:false,
  requestTimeout:30000
};

(function warmCrm(){
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
  timer=setTimeout(cleanup,30000);
  document.head.appendChild(script);
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