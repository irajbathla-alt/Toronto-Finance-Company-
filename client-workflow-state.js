(() => {
  'use strict';

  const PROGRESS_KEY = 'tfc-client-workflow-v1';
  const LEGACY_APPLICATION_KEY = 'tfc-current-application';
  const cfg = window.TFC_CONFIG || {};
  const minimumStatements = Number(cfg.minimumStatements || 6);
  let observer = null;
  let timer = null;

  function applicationId() {
    const visible = String(document.getElementById('appId')?.textContent || '');
    const match = visible.match(/TFC-[A-Z0-9-]+/i);
    if (match) return match[0];

    try {
      const stored = JSON.parse(localStorage.getItem(LEGACY_APPLICATION_KEY) || '{}');
      return String(stored.applicationId || '').trim();
    } catch (_) {
      return '';
    }
  }

  function readAllProgress() {
    try {
      const value = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_) {
      return {};
    }
  }

  function readProgress(id) {
    if (!id) return {};
    return readAllProgress()[id] || {};
  }

  function saveProgress(id, patch) {
    if (!id) return;
    const all = readAllProgress();
    all[id] = { ...(all[id] || {}), ...patch };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  }

  function statementCount() {
    const text = String(document.getElementById('statementCount')?.textContent || '');
    const match = text.match(/(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function signingIsConfirmed(id) {
    if (!id) return false;

    const progress = readProgress(id);
    const legacyConfirmed = localStorage.getItem('tfc-signed-' + id) === 'yes';
    const hasStatements = statementCount() > 0;
    const confirmed = progress.signed === true || legacyConfirmed || hasStatements;

    if (confirmed) {
      localStorage.setItem('tfc-signed-' + id, 'yes');
      if (progress.signed !== true) {
        saveProgress(id, {
          signed: true,
          restoredAt: new Date().toISOString(),
          restoredFrom: hasStatements ? 'statement-progress' : 'existing-confirmation'
        });
      }
    }

    return confirmed;
  }

  function confirmSigning(id) {
    if (!id) return;
    localStorage.setItem('tfc-signed-' + id, 'yes');
    saveProgress(id, {
      signed: true,
      signedAt: new Date().toISOString(),
      restoredFrom: 'client-confirmation'
    });
  }

  function hideFuturePlaceholders() {
    const future = document.querySelector('.future');
    if (!future) return;
    future.hidden = true;
    future.style.display = 'none';
    future.setAttribute('aria-hidden', 'true');
  }

  function syncWorkflow() {
    hideFuturePlaceholders();

    const id = applicationId();
    if (!id) return;

    const signed = signingIsConfirmed(id);
    const statements = statementCount();
    const statementsComplete = statements >= minimumStatements;

    const step1 = document.getElementById('step1card');
    const step2 = document.getElementById('step2card');
    const flow1 = document.getElementById('flow1');
    const flow2 = document.getElementById('flow2');
    const openSign = document.getElementById('openSign');
    const openUpload = document.getElementById('openUpload');
    const markSigned = document.getElementById('markSigned');
    const step1Confirmation = step1?.querySelector('.complete-tag');

    if (signed) {
      step1?.classList.add('complete');
      step2?.classList.remove('gated');

      if (flow1) {
        flow1.className = 'flowdot done';
        flow1.textContent = 'Step 1 · Review & Sign ✓';
      }
      if (openSign) openSign.textContent = 'Review Signed Application';
      if (openUpload) openUpload.disabled = false;
      if (markSigned) {
        markSigned.disabled = true;
        markSigned.textContent = 'Signing Confirmed ✓';
      }
      if (step1Confirmation) {
        step1Confirmation.textContent = '✓ Signature confirmed · Step 2 unlocked';
      }
    } else {
      if (flow1) flow1.textContent = 'Step 1 · Review & Sign';
      if (openSign) openSign.textContent = 'Open Review & Sign';
      if (markSigned) {
        markSigned.disabled = false;
        markSigned.textContent = 'I Have Finished Signing';
      }
    }

    if (flow2) {
      flow2.textContent = statementsComplete
        ? 'Step 2 · Bank Statements ✓'
        : 'Step 2 · Bank Statements';
    }
  }

  function install() {
    hideFuturePlaceholders();
    syncWorkflow();

    const watched = [
      document.getElementById('appId'),
      document.getElementById('statementCount')
    ].filter(Boolean);

    if (watched.length) {
      observer = new MutationObserver(() => syncWorkflow());
      watched.forEach(node => observer.observe(node, {
        childList: true,
        subtree: true,
        characterData: true
      }));
    }

    document.addEventListener('click', event => {
      if (!event.target.closest?.('#markSigned')) return;
      const id = applicationId();
      if (!id) return;
      confirmSigning(id);
      setTimeout(syncWorkflow, 0);
    }, true);

    timer = setInterval(syncWorkflow, 2500);
    window.addEventListener('pagehide', () => {
      if (timer) clearInterval(timer);
      observer?.disconnect();
    }, { once: true });
  }

  const style = document.createElement('style');
  style.id = 'tfc-client-workflow-state-style';
  style.textContent = '.future{display:none!important}';
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();