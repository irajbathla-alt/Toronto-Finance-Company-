(() => {
  const ADOBE_FORM_URL = "https://na4.documents.adobe.com/public/esignWidget?wid=CBFCIBAA3AAABLblqZhDwBP3O12llfz6E2qh5kn4Ch8DVeiTCHHX-Jsrz2IEcSqCQuOtpllMBVrr8wp79Z5o*";

  function installAdobeSignTab() {
    const tabs = document.querySelector('.tabs');
    const grid = document.querySelector('.grid');
    if (!tabs || !grid || document.getElementById('review-sign')) return;

    const tabButton = document.createElement('button');
    tabButton.type = 'button';
    tabButton.dataset.tab = 'review-sign';
    tabButton.textContent = 'Review & Sign';
    tabs.insertBefore(tabButton, tabs.querySelector('[data-tab="status"]'));

    const panel = document.createElement('article');
    panel.className = 'card full panel';
    panel.id = 'review-sign';
    panel.innerHTML = `
      <div class="adobe-sign-heading">
        <div>
          <h2>Review & Sign Application</h2>
          <p class="muted">Review the application below and complete your secure electronic signature through Adobe Acrobat Sign.</p>
        </div>
        <span class="adobe-secure-badge">Secure E-Signature</span>
      </div>
      <div class="adobe-sign-notice">
        By signing, you confirm that the information provided is true, accurate and complete, and authorize Toronto Finance Company to submit your application and supporting information to one or more lenders and financing partners for assessment.
      </div>
      <div class="adobe-frame-wrap">
        <iframe
          src="${ADOBE_FORM_URL}"
          title="Toronto Finance Company Secure Electronic Signature"
          width="100%"
          height="980"
          frameborder="0"
          scrolling="yes"
          allow="clipboard-write"
          loading="lazy"></iframe>
      </div>
      <p class="muted adobe-help">Adobe Acrobat Sign maintains the signed agreement and electronic-signature audit trail. After signing, return to this dashboard for application updates.</p>`;
    grid.appendChild(panel);

    const style = document.createElement('style');
    style.textContent = `
      .adobe-sign-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:16px}
      .adobe-sign-heading h2{margin:0 0 7px}
      .adobe-secure-badge{flex:0 0 auto;border:1px solid #c6964e;border-radius:999px;padding:8px 12px;font-size:9px;letter-spacing:.11em;text-transform:uppercase;color:#80602f;background:#fffaf2}
      .adobe-sign-notice{padding:16px 18px;margin:0 0 18px;border-left:3px solid #c6964e;background:#fbf7f0;font-size:12px;line-height:1.65}
      .adobe-frame-wrap{width:100%;min-height:760px;border:1px solid rgba(23,19,15,.13);border-radius:10px;overflow:hidden;background:#fff}
      .adobe-frame-wrap iframe{display:block;width:100%;min-width:0;min-height:980px;border:0}
      .adobe-help{margin:14px 0 0;line-height:1.6}
      @media(max-width:760px){
        .adobe-sign-heading{flex-direction:column}
        .adobe-frame-wrap{min-height:840px;overflow:auto;-webkit-overflow-scrolling:touch}
        .adobe-frame-wrap iframe{min-width:600px;min-height:980px}
      }`;
    document.head.appendChild(style);

    tabButton.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
      tabButton.classList.add('active');
      panel.classList.add('active');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAdobeSignTab);
  } else {
    installAdobeSignTab();
  }
})();
