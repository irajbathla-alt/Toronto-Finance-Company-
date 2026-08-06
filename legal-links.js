(() => {
  const connectLegalLinks = () => {
    const nav = document.querySelector('.navlinks');
    if (!nav) return;

    [...nav.querySelectorAll('button')].forEach(button => {
      const label = button.textContent.trim().toLowerCase();
      if (label === 'privacy') {
        button.removeAttribute('data-go');
        button.onclick = () => { window.location.href = 'privacy.html'; };
      }
    });

    if (!nav.querySelector('[data-legal-terms]')) {
      const terms = document.createElement('button');
      terms.textContent = 'Terms';
      terms.dataset.legalTerms = 'true';
      terms.onclick = () => { window.location.href = 'terms.html'; };
      const login = [...nav.querySelectorAll('button')].find(button => button.textContent.trim().toLowerCase() === 'log in');
      nav.insertBefore(terms, login || null);
    }
  };

  connectLegalLinks();
  new MutationObserver(connectLegalLinks).observe(document.body, { childList: true, subtree: true });
})();