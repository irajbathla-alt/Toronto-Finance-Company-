(() => {
  const enhanceButtons = () => {
    const eligibilityButton = document.querySelector('.btn-gold');
    if (eligibilityButton && eligibilityButton.dataset.eligibilityReady !== 'true') {
      eligibilityButton.dataset.eligibilityReady = 'true';
      eligibilityButton.textContent = 'Check Eligibility';
      eligibilityButton.removeAttribute('data-go');
      eligibilityButton.onclick = (event) => {
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
    }

    const applyButton = document.querySelector('.btn-ghost');
    if (applyButton && applyButton.dataset.applyReady !== 'true') {
      applyButton.dataset.applyReady = 'true';
      applyButton.textContent = 'Apply Now';
      applyButton.setAttribute('data-go', 'apply');
      applyButton.onclick = (event) => {
        event.preventDefault();
        apply(1);
      };
    }
  };

  enhanceButtons();
  new MutationObserver(enhanceButtons).observe(document.body, { childList: true, subtree: true });
})();