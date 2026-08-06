window.TFC_CONFIG={
  apiUrl:"https://script.google.com/macros/s/AKfycby6bmKACh-ddzZ9_Qy20pZgIhr-xJkxtH8q3Y0X9TxX3OVbXUeIkpGsiL6Jya4fwClX/exec",
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
}

if (/admin\.html$/i.test(window.location.pathname)) {
  const adminTools=document.createElement('script');
  adminTools.src='admin-crm-tools.js?v=20260806-1';
  adminTools.defer=true;
  document.head.appendChild(adminTools);
}

if (/client-portal\.html$/i.test(window.location.pathname)) {
  const adobeSignScript = document.createElement('script');
  adobeSignScript.src = 'adobe-sign-embed.js';
  adobeSignScript.defer = true;
  document.head.appendChild(adobeSignScript);
}
