(() => {
  const SESSION_KEY = 'tfc-client-auth';
  const LEGACY_KEY = 'tfc-current-application';

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_KEY);
  }

  function saveSession(data) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      applicationId: data.applicationId,
      email: data.email || '',
      authenticatedAt: new Date().toISOString()
    }));
    localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
  }

  function install() {
    const loginButton = document.getElementById('loginBtn');
    const logoutButton = document.getElementById('logout');
    const loginMessage = document.getElementById('loginMsg');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    if (!loginButton || typeof api !== 'function' || typeof showDashboard !== 'function') {
      setTimeout(install, 80);
      return;
    }

    loginButton.onclick = async () => {
      const email = (emailInput?.value || '').trim().toLowerCase();
      const password = passwordInput?.value || '';

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        if (loginMessage) loginMessage.textContent = 'Please enter a valid email address.';
        return;
      }
      if (!password) {
        if (loginMessage) loginMessage.textContent = 'Please enter your password.';
        return;
      }

      clearSession();
      loginButton.disabled = true;
      loginButton.textContent = 'Signing In...';
      if (loginMessage) loginMessage.textContent = 'Checking your secure account...';

      try {
        const result = await api('clientLogin', { email, password });
        if (!result?.ok) throw new Error(result?.error || 'Login failed.');
        saveSession(result.data);
        if (loginMessage) loginMessage.textContent = '';
        history.replaceState({}, '', 'client-dashboard.html');
        showDashboard(result.data);
      } catch (error) {
        clearSession();
        if (loginMessage) loginMessage.textContent = error.message || 'Login failed.';
      } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Log In';
      }
    };

    if (passwordInput && passwordInput.dataset.loginEnterReady !== 'true') {
      passwordInput.dataset.loginEnterReady = 'true';
      passwordInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') loginButton.click();
      });
    }

    if (logoutButton) {
      logoutButton.onclick = () => {
        if (typeof refreshTimer !== 'undefined' && refreshTimer) clearInterval(refreshTimer);
        clearSession();
        window.location.replace('index.html');
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();