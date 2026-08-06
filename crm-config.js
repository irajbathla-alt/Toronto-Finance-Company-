window.TFC_CONFIG={
  apiUrl:"https://script.google.com/macros/s/AKfycbxeKEo8MZtfQbCla7cCBbThaMkGk-CltycfR2IE2Uk9WcO52sS9ok4Wej_gIOOsI7MP/exec",
  minimumStatements:6,
  demoMode:false
};

if (/client-portal\.html$/i.test(window.location.pathname)) {
  const adobeSignScript = document.createElement('script');
  adobeSignScript.src = 'adobe-sign-embed.js';
  adobeSignScript.defer = true;
  document.head.appendChild(adobeSignScript);
}

if (/admin\.html$/i.test(window.location.pathname)) {
  const adminSaveFixScript = document.createElement('script');
  adminSaveFixScript.src = 'admin-save-fix.js';
  adminSaveFixScript.defer = true;
  document.head.appendChild(adminSaveFixScript);
}
