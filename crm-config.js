window.TFC_CONFIG={
  apiUrl:"https://script.google.com/macros/s/AKfycby6bmKACh-ddzZ9_Qy20pZgIhr-xJkxtH8q3Y0X9TxX3OVbXUeIkpGsiL6Jya4fwClX/exec",
  minimumStatements:6,
  demoMode:false
};

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