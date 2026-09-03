(() => {
  'use strict';

  const PROGRESS_KEY = 'tfc-client-workflow-v1';
  const LEGACY_APPLICATION_KEY = 'tfc-current-application';
  const SERVER_SYNC_PREFIX = 'tfc-signature-sync-';
  const cfg = window.TFC_CONFIG || {};
  const minimumStatements = Number(cfg.minimumStatements || 6);
  let observer = null;
  let timer = null;

  function applicationId() {
    const visible = String(document.getElementById('appId')?.textContent || '');
    const match = visible.match(/TFC-[A-Z0-9-]+/i);
    if (match) return match[0];

    const stored = storedApplication();
    return String(stored.applicationId || '').trim();
  }

  function storedApplication() {
    try {
      const stored = JSON.parse(localStorage.getItem(LEGACY_APPLICATION_KEY) || '{}');
      return stored && typeof stored === 'object' ? stored : {};
    } catch (_) {
      return {};
    }
  }

  function isTrue(value) {
    return value === true || ['true','1','yes'].includes(String(value || '').toLowerCase());
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

  function crmSignatureConfirmed(id) {
    const stored = storedApplication();
    return Boolean(
      id &&
      String(stored.applicationId || '') === String(id) &&
      isTrue(stored.signatureConfirmed)
    );
  }

  function signingIsConfirmed(id) {
    if (!id) return false;

    const progress = readProgress(id);
    const crmConfirmed = crmSignatureConfirmed(id);
    const legacyConfirmed = localStorage.getItem('tfc-signed-' + id) === 'yes';
    const hasStatements = statementCount() > 0;
    const confirmed = progress.signed === true || crmConfirmed || legacyConfirmed || hasStatements;

    if (confirmed) {
      localStorage.setItem('tfc-signed-' + id, 'yes');
      if (progress.signed !== true || crmConfirmed) {
        saveProgress(id, {
          signed: true,
          restoredAt: new Date().toISOString(),
          restoredFrom: crmConfirmed
            ? 'crm-confirmation'
            : hasStatements
              ? 'statement-progress'
              : 'existing-confirmation'
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

  function jsonp(action, payload = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('CRM endpoint is not configured.'));

      const callback = `tfc_signature_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({ action, callback, _: String(Date.now()) });
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Signature confirmation timed out.'));
      }, timeout);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callback] = data => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('Signature confirmation service could not be reached.'));
      };

      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function persistSignatureToCrm(id) {
    const stored = storedApplication();
    const email = String(stored.email || '').trim().toLowerCase();
    if (!id || !email || crmSignatureConfirmed(id)) return;

    const attemptKey = SERVER_SYNC_PREFIX + id;
    if (sessionStorage.getItem(attemptKey) === 'working') return;
    sessionStorage.setItem(attemptKey, 'working');

    try {
      const result = await jsonp('clientConfirmSignature', {
        applicationId: id,
        email
      });

      if (!result?.ok) throw new Error(result?.error || 'Signature confirmation could not be saved.');

      const fresh = result.data || {};
      localStorage.setItem(LEGACY_APPLICATION_KEY, JSON.stringify({ ...stored, ...fresh }));
      saveProgress(id, {
        signed: true,
        serverSyncedAt: new Date().toISOString(),
        restoredFrom: 'crm-confirmation'
      });
      sessionStorage.setItem(attemptKey, 'done');
      syncWorkflow();
    } catch (_) {
      sessionStorage.setItem(attemptKey, 'failed');
    }
  }

  function maybeSyncSignatureToCrm(id) {
    if (!id || crmSignatureConfirmed(id)) return;
    if (!signingIsConfirmed(id)) return;

    const attemptKey = SERVER_SYNC_PREFIX + id;
    if (sessionStorage.getItem(attemptKey)) return;
    persistSignatureToCrm(id);
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
        markSigned.textContent = crmSignatureConfirmed(id)
          ? 'Signing Confirmed ✓'
          : 'Signing Confirmed ✓';
      }
      if (step1Confirmation) {
        step1Confirmation.textContent = '✓ Signature confirmed · Step 2 unlocked';
      }
    } else {
      step1?.classList.remove('complete');
      step2?.classList.add('gated');
      if (flow1) {
        flow1.className = 'flowdot active';
        flow1.textContent = 'Step 1 · Review & Sign';
      }
      if (openSign) openSign.textContent = 'Open Review & Sign';
      if (openUpload) openUpload.disabled = true;
      if (markSigned) {
        markSigned.disabled = false;
        markSigned.textContent = 'I Have Finished Signing';
      }
    }

    if (flow2) {
      flow2.className = 'flowdot ' + (statementsComplete ? 'done' : signed ? 'active' : '');
      flow2.textContent = statementsComplete
        ? 'Step 2 · Bank Statements ✓'
        : 'Step 2 · Bank Statements';
    }

    maybeSyncSignatureToCrm(id);
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
      persistSignatureToCrm(id);
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