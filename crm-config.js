window.TFC_CONFIG={
  apiUrl:"https://script.google.com/macros/s/AKfycbxeKEo8MZtfQbCla7cCBbThaMkGk-CltycfR2IE2Uk9WcO52sS9ok4Wej_gIOOsI7MP/exec",
  minimumStatements:6,
  demoMode:false
};

(function loadMotionSystem(){
  if(!document.querySelector('link[data-tfc-motion]')){
    const motionStyles=document.createElement('link');
    motionStyles.rel='stylesheet';
    motionStyles.href='motion.css?v=20260806-1';
    motionStyles.dataset.tfcMotion='true';
    document.head.appendChild(motionStyles);
  }
  if(!document.querySelector('script[data-tfc-motion]')){
    const motionScript=document.createElement('script');
    motionScript.src='motion.js?v=20260806-1';
    motionScript.defer=true;
    motionScript.dataset.tfcMotion='true';
    document.head.appendChild(motionScript);
  }
})();

if (/client-portal\.html$/i.test(window.location.pathname)) {
  const adobeSignScript = document.createElement('script');
  adobeSignScript.src = 'adobe-sign-embed.js';
  adobeSignScript.defer = true;
  document.head.appendChild(adobeSignScript);
}
