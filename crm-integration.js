(() => {
  'use strict';
  const CRM = window.TFC_CRM;
  const cfg = window.TFC_CONFIG || {};

  function enhance() {
    document.querySelectorAll('[data-go="dashboard"]').forEach(button => {
      if (button.dataset.crmLoginReady) return;
      button.dataset.crmLoginReady = 'true';
      button.textContent = 'Log In';
      button.onclick = event => {
        event.preventDefault();
        location.href = 'client-dashboard.html?login=1';
      };
    });

    const button = document.getElementById('createAccountBtn');
    if (!button || button.dataset.crmCreateReady) return;
    button.dataset.crmCreateReady = 'true';

    const passwordInput = document.getElementById('password');
    if (passwordInput && !passwordInput.dataset.enterReady) {
      passwordInput.dataset.enterReady = 'true';
      passwordInput.addEventListener('keydown',event => { if (event.key === 'Enter') button.click(); });
    }

    button.onclick = async () => {
      const name = document.getElementById('name')?.value.trim() || '';
      const email = document.getElementById('email')?.value.trim().toLowerCase() || '';
      const password = document.getElementById('password')?.value || '';
      const message = document.getElementById('accountMessage');

      if (!name) return message && (message.textContent = 'Please enter your full name.');
      if (!/^\S+@\S+\.\S+$/.test(email)) return message && (message.textContent = 'Please enter a valid email address.');
      if (password.length < 8) return message && (message.textContent = 'Your password must contain at least 8 characters.');
      if (!cfg.apiUrl) return message && (message.textContent = 'The CRM service is not configured.');

      CRM.clearSession();
      button.disabled = true;
      button.textContent = 'Creating Account…';
      if (message) message.textContent = 'Creating your secure client account…';

      try {
        const result = await CRM.createAccount({ name, email, password });
        if (!result?.data?.applicationId) throw new Error('The account could not be opened. Please log in.');
        button.textContent = 'Account Created';
        if (message) message.textContent = 'Success. Opening your secure dashboard…';
        location.assign('client-dashboard.html?created=1');
      } catch (error) {
        CRM.clearSession();
        if (message) message.textContent = error.message || 'Account creation failed. Please try again.';
        button.disabled = false;
        button.textContent = 'Create Account';
      }
    };
  }

  enhance();
  new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});
})();