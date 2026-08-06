(() => {
  if (window.__TFC_MOTION_LOADED__) return;
  window.__TFC_MOTION_LOADED__ = true;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealSelector = [
    'main > section',
    'main > article',
    '.hero > *',
    '.metrics > *',
    '.cards > *',
    '.flow > *',
    '.future > *',
    '.summary > *',
    '.products > *',
    '.workspace',
    '.advisor',
    '.formwrap',
    '.wrap',
    '.shell'
  ].join(',');

  let observer;

  function revealNow(element) {
    element.classList.add('is-visible');
  }

  function register(root = document) {
    const elements = [...root.querySelectorAll(revealSelector)]
      .filter(element => !element.classList.contains('tfc-reveal'));

    elements.forEach((element, index) => {
      if (element.closest('[hidden], .hidden') || getComputedStyle(element).display === 'none') return;
      element.classList.add('tfc-reveal');
      element.style.setProperty('--tfc-delay', `${Math.min(index % 6, 5) * 55}ms`);

      if (reduceMotion || !observer) revealNow(element);
      else observer.observe(element);
    });
  }

  function setupRevealObserver() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        revealNow(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
  }

  function isInternalNavigation(anchor) {
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return false;
    const raw = anchor.getAttribute('href') || '';
    if (!raw || raw.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(raw)) return false;

    let url;
    try { url = new URL(anchor.href, window.location.href); } catch (_) { return false; }
    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
    return true;
  }

  function setupPageTransitions() {
    document.addEventListener('click', event => {
      if (reduceMotion || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest('a[href]');
      if (!isInternalNavigation(anchor)) return;

      event.preventDefault();
      document.body.classList.add('tfc-page-leaving');
      setTimeout(() => { window.location.href = anchor.href; }, 165);
    });

    window.addEventListener('pageshow', () => document.body.classList.remove('tfc-page-leaving'));
  }

  function setupDynamicContent() {
    if (!('MutationObserver' in window)) return;
    const mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches?.(revealSelector)) register(node.parentElement || document);
        else register(node);
      }));
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    setupRevealObserver();
    register();
    setupPageTransitions();
    setupDynamicContent();
    document.documentElement.classList.add('tfc-motion-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();