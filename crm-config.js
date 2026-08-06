window.TFC_CONFIG={
  apiUrl:"https://script.google.com/macros/s/AKfycbxeKEo8MZtfQbCla7cCBbThaMkGk-CltycfR2IE2Uk9WcO52sS9ok4Wej_gIOOsI7MP/exec",
  minimumStatements:6,
  demoMode:false
};

(function loadMotionSystem(){
  if(!document.querySelector('link[data-tfc-motion]')){
    const motionStyles=document.createElement('link');
    motionStyles.rel='stylesheet';
    motionStyles.href='motion.css?v=20260806-2';
    motionStyles.dataset.tfcMotion='true';
    document.head.appendChild(motionStyles);
  }
  if(!document.querySelector('script[data-tfc-motion]')){
    const motionScript=document.createElement('script');
    motionScript.src='motion.js?v=20260806-2';
    motionScript.defer=true;
    motionScript.dataset.tfcMotion='true';
    document.head.appendChild(motionScript);
  }
})();

if (/client-dashboard\.html$/i.test(window.location.pathname)) {
  const SESSION_KEY='tfc-client-auth';
  const LEGACY_KEY='tfc-current-application';
  const forceFreshLogin=new URLSearchParams(window.location.search).get('login')==='1';
  let session={},stored={};

  try{session=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'{}')}catch(_){session={}}
  try{stored=JSON.parse(localStorage.getItem(LEGACY_KEY)||'{}')}catch(_){stored={}}

  const validSession=Boolean(
    session.applicationId&&
    stored.applicationId&&
    String(session.applicationId)===String(stored.applicationId)
  );

  if(forceFreshLogin||!validSession){
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_KEY);
  }

  const authFix=document.createElement('script');
  authFix.src='client-auth-fix.js?v=20260806-1';
  authFix.defer=true;
  document.head.appendChild(authFix);
}

if (/client-portal\.html$/i.test(window.location.pathname)) {
  const adobeSignScript = document.createElement('script');
  adobeSignScript.src = 'adobe-sign-embed.js';
  adobeSignScript.defer = true;
  document.head.appendChild(adobeSignScript);
}
