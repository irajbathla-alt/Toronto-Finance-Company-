(() => {
  const enhanceButton = () => {
    const button = document.querySelector('.btn-gold');
    if (!button || button.dataset.eligibilityReady === 'true') return;

    button.dataset.eligibilityReady = 'true';
    button.textContent = 'Check Eligibility';
    button.removeAttribute('data-go');
    button.onclick = (event) => {
      event.preventDefault();
      const width = Math.min(560, window.screen.availWidth - 30);
      const height = Math.min(820, window.screen.availHeight - 40);
      const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
      const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
      window.open(
        'eligibility.html',
        'TorontoFinanceEligibility',
        `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
    };
  };

  enhanceButton();
  new MutationObserver(enhanceButton).observe(document.body, { childList: true, subtree: true });
})();