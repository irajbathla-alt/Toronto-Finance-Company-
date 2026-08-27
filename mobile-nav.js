(() => {
  const app = document.querySelector('#app');
  if (!app) return;

  const closeMenu = () => {
    const toggle = document.querySelector('.mobile-nav-toggle');
    const menu = document.querySelector('.mobile-nav-menu');
    const landing = document.querySelector('.landing');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (menu) menu.classList.remove('open');
    if (landing) landing.classList.remove('mobile-menu-open');
  };

  const go = destination => {
    closeMenu();
    if (destination === 'experience') window.location.href = 'experience.html';
    else if (destination === 'about') window.location.href = 'about.html';
    else if (destination === 'privacy') window.location.href = 'privacy.html';
    else if (destination === 'terms') window.location.href = 'terms.html';
    else if (destination === 'login') window.location.href = 'client-dashboard.html?login=1&v=20260818-endpoint2';
    else if (destination === 'apply' && typeof window.apply === 'function') window.apply();
    else if (destination === 'apply') window.location.href = 'index.html?apply=1';
  };

  const enhanceMobileNav = () => {
    const nav = document.querySelector('.landing .nav');
    if (!nav || nav.dataset.mobileNavReady === 'true') return;
    nav.dataset.mobileNavReady = 'true';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-nav-toggle';
    toggle.setAttribute('aria-label', 'Open navigation menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'mobileNavMenu');
    toggle.innerHTML = '<span></span>';

    const menu = document.createElement('div');
    menu.id = 'mobileNavMenu';
    menu.className = 'mobile-nav-menu';
    menu.setAttribute('aria-label', 'Mobile navigation');
    menu.innerHTML = `
      <button type="button" data-mobile-nav="experience">Experience</button>
      <button type="button" data-mobile-nav="about">About</button>
      <button type="button" data-mobile-nav="privacy">Privacy</button>
      <button type="button" data-mobile-nav="terms">Terms</button>
      <button type="button" data-mobile-nav="login">Log In</button>
      <button type="button" class="mobile-apply" data-mobile-nav="apply">Apply</button>`;

    nav.appendChild(toggle);
    nav.appendChild(menu);

    toggle.addEventListener('click', event => {
      event.stopPropagation();
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      menu.classList.toggle('open', !open);
      const landing = document.querySelector('.landing');
      if (landing) landing.classList.toggle('mobile-menu-open', !open);
    });

    menu.addEventListener('click', event => {
      const button = event.target.closest('[data-mobile-nav]');
      if (!button) return;
      go(button.dataset.mobileNav);
    });
  };

  document.addEventListener('click', event => {
    if (!event.target.closest('.mobile-nav-menu') && !event.target.closest('.mobile-nav-toggle')) closeMenu();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 760) closeMenu();
  });

  enhanceMobileNav();
  new MutationObserver(enhanceMobileNav).observe(app, { childList: true, subtree: true });
})();
