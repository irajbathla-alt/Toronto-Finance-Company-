(() => {
  'use strict';

  const PROGRESS_KEY = 'tfc-client-workflow-v1';
  const LEGACY_APPLICATION_KEY = 'tfc-current-application';
  const cfg = window.TFC_CONFIG || {};
  const minimumStatements = Number(cfg.minimumStatements || 6);
  const syncAttempts = new Map();
  const syncInFlight = new Set();
  let observer = null;
  let safetyTimer = null;

  function storedApplication() {
    try {
      const stored = JSON.parse(localStorage.getItem(LEGACY_APPLICATION_KEY) || '{}');
      return stored && typeof stored === 'object' ? stored : {};
    } catch (_) {
      return {};
    }
  }

  function applicationId() {
    const visible = String(document.getElementById('appId')?.textContent || '');
    const match = visible.match(/TFC-[A-Z0-9-]+/i);
    if (match) return match[0];
    return String(storedApplication().applicationId || '').trim();
  }

  function isTrue(value) {
    return value === true || ['true','1','yes'].includes(String(value || '').trim().toLowerCase());
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
    return id ? (readAllProgress()[id] || {}) : {};
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
    const serverConfirmed = crmSignatureConfirmed(id);
    const legacyConfirmed = localStorage.getItem('tfc-signed-' + id) === 'yes';
    const hasStatements = statementCount() > 0;
    const confirmed = serverConfirmed || progress.signed === true || legacyConfirmed || hasStatements;

    if (!confirmed) return false;

    if (!legacyConfirmed) localStorage.setItem('tfc-signed-' + id, 'yes');

    const desiredSource = serverConfirmed
      ? 'crm-confirmation'
      : hasStatements
        ? 'statement-progress'
        : 'existing-confirmation';

    if (progress.signed !== true || progress.restoredFrom !== desiredSource) {
      saveProgress(id, {
        signed: true,
        restoredAt: progress.restoredAt || new Date().toISOString(),
        restoredFrom: desiredSource
      });
    }

    return true;
  }

  function confirmSigningLocally(id) {
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

  function updateStoredApplication(fresh) {
    if (!fresh || typeof fresh !== 'object') return;
    const stored = storedApplication();
    localStorage.setItem(LEGACY_APPLICATION_KEY, JSON.stringify({ ...stored, ...fresh }));
    try {
      if (typeof client !== 'undefined' && client && String(client.applicationId) === String(fresh.applicationId)) {
        client = { ...client, ...fresh };
      }
    } catch (_) {}
  }

  function scheduleRetry(id) {
    const attempts = Number(syncAttempts.get(id) || 0);
    if (attempts >= 3) return;
    const delays = [5000, 15000, 30000];
    setTimeout(() => persistSignatureToCrm(id), delays[attempts] || 30000);
  }

  async function persistSignatureToCrm(id) {
    const stored = storedApplication();
    const email = String(stored.email || '').trim().toLowerCase();
    if (!id || !email || crmSignatureConfirmed(id) || syncInFlight.has(id)) return;

    syncInFlight.add(id);
    const attempts = Number(syncAttempts.get(id) || 0);

    try {
      const result = await jsonp('clientConfirmSignature', { applicationId: id, email });
      if (!result?.ok) throw new Error(result?.error || 'Signature confirmation could not be saved.');

      updateStoredApplication(result.data || {});
      saveProgress(id, {
        signed: true,
        serverSyncedAt: new Date().toISOString(),
        restoredFrom: 'crm-confirmation'
      });
      syncAttempts.delete(id);
      syncWorkflow();
    } catch (_) {
      syncAttempts.set(id, attempts + 1);
      scheduleRetry(id);
    } finally {
      syncInFlight.delete(id);
    }
  }

  function maybeSyncSignatureToCrm(id) {
    if (!id || crmSignatureConfirmed(id) || !signingIsConfirmed(id)) return;
    if (syncInFlight.has(id)) return;
    if (Number(syncAttempts.get(id) || 0) >= 3) return;
    persistSignatureToCrm(id);
  }

  function hideFuturePlaceholders() {
    const future = document.querySelector('.future');
    if (!future) return;
    future.hidden = true;
    future.style.display = 'none';
    future.setAttribute('aria-hidden', 'true');
  }

  function renderWorkflowMessage(signed, statementsComplete) {
    const data = storedApplication();
    const status = String(data.status || '');
    const title = document.getElementById('workflowTitle');
    const body = document.getElementById('workflowBody');
    if (!title || !body) return;

    if (String(data.documentsRequested || '').trim()) {
      title.textContent = 'Additional Documents Requested';
      body.textContent = 'Please review the requested items below and upload the documents needed to continue.';
      return;
    }

    if (['Conditional Approval','Approved'].includes(status) && !data.clientDecision) {
      title.textContent = 'Financing Available';
      body.textContent = 'Review the financing details below and choose Proceed or Request More Information.';
      return;
    }

    if (data.clientDecision === 'Proceed') {
      title.textContent = 'Response Received';
      body.textContent = 'Thank you. You asked us to proceed. Your advisor has been notified and will continue with the next step.';
      return;
    }

    if (data.clientDecision === 'Request More Information') {
      title.textContent = 'More Information Requested';
      body.textContent = 'Your advisor has been notified and will follow up with the information you requested.';
      return;
    }

    if (signed && statementsComplete) {
      title.textContent = 'Required Steps Completed';
      body.textContent = 'Your signed application and required bank statements have been received.';
    } else if (signed) {
      title.textContent = 'Upload Your Bank Statements';
      body.textContent = 'Your signature step is complete. Please upload six recent monthly business bank statements.';
    } else {
      title.textContent = 'Complete Your Application';
      body.textContent = 'First review and sign the application, then upload six recent business bank statements.';
    }
  }

  function bridgeDashboardIsSigned() {
    try {
      if (typeof isSigned !== 'function' || isSigned.__tfcServerAware) return;
      const bridged = function() {
        return signingIsConfirmed(applicationId());
      };
      bridged.__tfcServerAware = true;
      isSigned = bridged;
    } catch (_) {}
  }

  function syncWorkflow() {
    hideFuturePlaceholders();
    bridgeDashboardIsSigned();

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

    step1?.classList.toggle('complete', signed);
    step2?.classList.toggle('gated', !signed);

    if (flow1) {
      flow1.className = 'flowdot ' + (signed ? 'done' : 'active');
      flow1.textContent = signed ? 'Step 1 · Review & Sign ✓' : 'Step 1 · Review & Sign';
    }

    if (openSign) openSign.textContent = signed ? 'Review Signed Application' : 'Open Review & Sign';
    if (openUpload) openUpload.disabled = !signed;

    if (markSigned) {
      markSigned.disabled = signed;
      markSigned.textContent = signed ? 'Signing Confirmed ✓' : 'I Have Finished Signing';
    }

    if (step1Confirmation && signed) {
      step1Confirmation.textContent = '✓ Signature confirmed · Step 2 unlocked';
    }

    step2?.classList.toggle('complete', statementsComplete);
    if (flow2) {
      flow2.className = 'flowdot ' + (statementsComplete ? 'done' : signed ? 'active' : '');
      flow2.textContent = statementsComplete ? 'Step 2 · Bank Statements ✓' : 'Step 2 · Bank Statements';
    }

    renderWorkflowMessage(signed, statementsComplete);
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
      confirmSigningLocally(id);
      persistSignatureToCrm(id);
      setTimeout(syncWorkflow, 0);
    }, true);

    safetyTimer = setInterval(syncWorkflow, 10000);
    window.addEventListener('pagehide', () => {
      if (safetyTimer) clearInterval(safetyTimer);
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