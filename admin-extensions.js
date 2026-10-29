(() => {
  'use strict';

  const cfg = window.TFC_CONFIG || {};
  const $ = selector => document.querySelector(selector);
  const FIELDS = [
    'business','status','advisor','messageTitle','messageBody','approvedAmount','quote','term',
    'paymentFrequency','paymentAmount','numberPayments','totalRepayment','documentsRequested','notes'
  ];
  let currentApplicationId = '';

  document.addEventListener('click', event => {
    const openButton = event.target.closest('[data-open]');
    if (openButton?.dataset?.open) currentApplicationId = openButton.dataset.open;
  }, true);

  function applicationId() {
    if (currentApplicationId) return currentApplicationId;
    const match = String($('#dTitle')?.textContent || '').match(/TFC-\d+/i);
    return match ? match[0] : '';
  }

  function jsonp(action, payload = {}, timeout = 45000) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('CRM endpoint is not configured.'));
      const callback = `tfc_notify_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({ action, callback, _: String(Date.now()) });
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('The notification request timed out.'));
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
        reject(new Error('The notification service could not be reached.'));
      };

      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  function buildUpdate() {
    const update = {
      applicationId: applicationId(),
      notifyClient: 'true'
    };
    FIELDS.forEach(key => {
      const field = $('#' + key);
      if (field) update[key] = field.value;
    });
    return update;
  }

  async function saveAndNotify() {
    const button = $('#saveNotify');
    const saveButton = $('#save');
    const message = $('#saveMsg');
    const update = buildUpdate();

    if (!update.applicationId) {
      if (message) {
        message.className = 'notice error';
        message.textContent = 'Open a client file before sending a notification.';
      }
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Sending…';
    }
    if (saveButton) saveButton.disabled = true;
    if (message) {
      message.className = 'notice';
      message.textContent = 'Saving the client update and sending a secure notification…';
    }

    try {
      const result = await jsonp('adminUpdate', update);
      if (!result?.ok) throw new Error(result?.error || 'The client update could not be saved.');

      const notification = result.notification || {};
      if (!notification.sent) {
        throw new Error(notification.error || 'The update was saved, but the client notification was not sent.');
      }

      if ($('#summaryStatus') && result.data?.status) $('#summaryStatus').textContent = result.data.status;
      if ($('#summaryAdvisor')) $('#summaryAdvisor').textContent = result.data?.advisor || 'Unassigned';
      if ($('#previewTitle')) $('#previewTitle').textContent = result.data?.messageTitle || 'Welcome';
      if ($('#previewBody')) $('#previewBody').textContent = result.data?.messageBody || 'Your advisor message will appear here.';

      if (message) {
        message.className = 'notice success';
        message.textContent = `Saved successfully. Client notification sent from ${notification.sender || 'info@torontofinancecompany.com'}.`;
      }

      const refresh = $('#refresh');
      if (refresh && !refresh.disabled) refresh.click();
    } catch (error) {
      if (message) {
        message.className = 'notice error';
        message.textContent = error.message || 'The client notification could not be sent.';
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Save & Notify Client';
      }
      if (saveButton) saveButton.disabled = false;
    }
  }

  const notifyButton = $('#saveNotify');
  if (notifyButton) notifyButton.onclick = saveAndNotify;
})();

(() => {
  'use strict';

  const SESSION_KEY = 'tfc-admin-session';
  const SESSION_TTL = 8 * 60 * 60 * 1000;
  const $ = selector => document.querySelector(selector);

  function readSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (!session.authenticatedAt) return null;
      if (Date.now() - Number(session.authenticatedAt) > SESSION_TTL) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch (_) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function saveSession() {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ authenticatedAt: Date.now() }));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('tfc-admin-token');
  }

  const admin = $('#admin');
  const login = $('#login');
  const logout = $('#logoutBtn');

  if (admin) {
    const observer = new MutationObserver(() => {
      if (!admin.classList.contains('hidden')) saveSession();
    });
    observer.observe(admin, { attributes: true, attributeFilter: ['class'] });
  }

  if (logout) {
    logout.onclick = () => {
      clearSession();
      location.reload();
    };
  }

  if (readSession()) {
    login?.classList.add('hidden');
    admin?.classList.remove('hidden');
    logout?.classList.remove('hidden');
    requestAnimationFrame(() => {
      const refresh = $('#refresh');
      if (refresh && !refresh.disabled) refresh.click();
    });
  }
})();

(() => {
  'use strict';

  const cfg = window.TFC_CONFIG || {};
  const REFRESH_MS = 25000;
  let currentApplicationId = '';
  let refreshTimer = null;
  let requestRunning = false;

  const $ = selector => document.querySelector(selector);

  function ensureUi() {
    if ($('#docActivityCard')) return;

    const style = document.createElement('style');
    style.id = 'docActivityStyles';
    style.textContent = `
      .doc-activity-card{margin-top:16px}
      .doc-activity-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}
      .doc-activity-head h3{margin:0}
      .doc-activity-refresh{border:1px solid var(--line,rgba(23,19,15,.13));background:#fbf7f0;border-radius:999px;padding:8px 12px;text-transform:uppercase;letter-spacing:.08em;font-size:9px;cursor:pointer;white-space:nowrap}
      .doc-activity-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      .doc-segment{min-height:88px;border:1px solid rgba(23,19,15,.12);background:#fbf7f0;border-radius:10px;padding:13px 14px;transition:.2s ease;display:flex;flex-direction:column;justify-content:space-between}
      .doc-segment span{font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#786f65;line-height:1.35}
      .doc-segment strong{font-family:'Cormorant Garamond',serif;font-size:25px;font-weight:400;line-height:1}
      .doc-segment small{font-size:9px;color:#8a8177}
      .doc-segment.received{background:#edf6f0;border-color:rgba(47,133,90,.36);box-shadow:inset 0 0 0 1px rgba(47,133,90,.06)}
      .doc-segment.received span,.doc-segment.received strong,.doc-segment.received small{color:#2f855a}
      .doc-activity-sync{margin-top:9px;font-size:10px;color:#786f65}
      @media(max-width:760px){.doc-activity-grid{grid-template-columns:1fr 1fr}.doc-activity-head{align-items:flex-start}}
    `;
    document.head.appendChild(style);

    const summary = $('.summary-grid');
    if (!summary) return;

    const card = document.createElement('section');
    card.id = 'docActivityCard';
    card.className = 'section card doc-activity-card';
    card.innerHTML = `
      <div class="doc-activity-head">
        <div><div class="eyebrow">Live From Google Drive</div><h3>Document Activity</h3></div>
        <button class="doc-activity-refresh" id="docActivityRefresh">Check Drive</button>
      </div>
      <div class="doc-activity-grid">
        <div class="doc-segment" id="docSegBank"><span>Bank Statements</span><strong id="docCountBank">0</strong><small id="docStateBank">Waiting</small></div>
        <div class="doc-segment" id="docSegId"><span>Identification</span><strong id="docCountId">0</strong><small id="docStateId">Waiting</small></div>
        <div class="doc-segment" id="docSegFinancial"><span>Financial Statements</span><strong id="docCountFinancial">0</strong><small id="docStateFinancial">Waiting</small></div>
        <div class="doc-segment" id="docSegOther"><span>Other Documents</span><strong id="docCountOther">0</strong><small id="docStateOther">Waiting</small></div>
      </div>
      <div class="doc-activity-sync" id="docActivitySync">Open a client file to check Drive.</div>
    `;
    summary.insertAdjacentElement('afterend', card);
    $('#docActivityRefresh').onclick = () => refreshDocuments(true);
  }

  function jsonp(action, payload = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('CRM endpoint is not configured.'));
      const callback = `tfc_docs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({ action, callback, _: String(Date.now()) });
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Drive check timed out.'));
      }, timeout);
      function cleanup() {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[callback] = data => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error('Drive check could not be completed.')); };
      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  function bucketDocuments(docs = []) {
    return docs.reduce((counts, doc) => {
      const type = String(doc?.type || '').toLowerCase();
      if (type === 'statement') counts.bank += 1;
      else if (type === 'identification') counts.id += 1;
      else if (type === 'financial') counts.financial += 1;
      else counts.other += 1;
      return counts;
    }, { bank: 0, id: 0, financial: 0, other: 0 });
  }

  function setSegment(key, count) {
    const map = {
      bank: ['#docSegBank', '#docCountBank', '#docStateBank'],
      id: ['#docSegId', '#docCountId', '#docStateId'],
      financial: ['#docSegFinancial', '#docCountFinancial', '#docStateFinancial'],
      other: ['#docSegOther', '#docCountOther', '#docStateOther']
    };
    const [segmentSelector, countSelector, stateSelector] = map[key];
    const segment = $(segmentSelector);
    if (!segment) return;
    segment.classList.toggle('received', count > 0);
    $(countSelector).textContent = String(count);
    $(stateSelector).textContent = count > 0 ? 'Received' : 'Waiting';
  }

  function renderDocuments(docs = []) {
    const counts = bucketDocuments(docs);
    Object.entries(counts).forEach(([key, count]) => setSegment(key, count));
    const total = docs.length;
    const sync = $('#docActivitySync');
    if (sync) sync.textContent = `${total} document${total === 1 ? '' : 's'} found in Drive · checked ${new Date().toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit' })}`;
  }

  async function refreshDocuments(showFeedback = false) {
    ensureUi();
    if (!currentApplicationId || requestRunning) return;
    requestRunning = true;
    const button = $('#docActivityRefresh');
    if (button) {
      button.disabled = true;
      button.textContent = 'Checking…';
    }
    if (showFeedback && $('#docActivitySync')) $('#docActivitySync').textContent = 'Checking the client’s Google Drive folders…';
    try {
      const result = await jsonp('getDocuments', { applicationId: currentApplicationId });
      if (!result?.ok) throw new Error(result?.error || 'Drive documents could not be loaded.');
      renderDocuments(result.data || []);
    } catch (error) {
      if ($('#docActivitySync')) $('#docActivitySync').textContent = error.message || 'Drive check could not be completed.';
    } finally {
      requestRunning = false;
      if (button) {
        button.disabled = false;
        button.textContent = 'Check Drive';
      }
    }
  }

  function selectApplication(id) {
    const clean = String(id || '').trim();
    if (!/^TFC-/i.test(clean)) return;
    const changed = clean !== currentApplicationId;
    currentApplicationId = clean;
    ensureUi();
    if (changed) {
      ['bank','id','financial','other'].forEach(key => setSegment(key, 0));
      if ($('#docActivitySync')) $('#docActivitySync').textContent = 'Checking the client’s Google Drive folders…';
    }
    setTimeout(() => refreshDocuments(false), 250);
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      const drawer = $('#drawer');
      if (drawer?.classList.contains('show') && !document.hidden) refreshDocuments(false);
    }, REFRESH_MS);
  }

  document.addEventListener('click', event => {
    const open = event.target.closest?.('[data-open]');
    if (open?.dataset?.open) selectApplication(open.dataset.open);
    if (event.target.closest?.('#close') || event.target.closest?.('#backdrop')) {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }, true);

  const titleObserver = new MutationObserver(() => {
    const match = String($('#dTitle')?.textContent || '').match(/TFC-[A-Z0-9-]+/i);
    if (match) selectApplication(match[0]);
  });

  function install() {
    ensureUi();
    const title = $('#dTitle');
    if (title) titleObserver.observe(title, { childList:true, subtree:true, characterData:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();

(() => {
  'use strict';

  if (window.__TFC_AUDIT_TRAIL__) return;
  window.__TFC_AUDIT_TRAIL__ = true;

  const cfg = window.TFC_CONFIG || {};
  const $ = selector => document.querySelector(selector);
  let currentApplicationId = '';
  let events = [];
  let loading = false;

  function jsonp(action, payload = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('CRM endpoint is not configured.'));
      const callback = `tfc_audit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({ action, callback, _: String(Date.now()) });
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Audit trail request timed out.'));
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
        reject(new Error('Audit trail service could not be reached.'));
      };

      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('en-CA', {
      month:'short',
      day:'numeric',
      year:'numeric',
      hour:'numeric',
      minute:'2-digit'
    });
  }

  function short(value, limit = 150) {
    const text = String(value ?? '').trim();
    return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
  }

  function matchesFilter(event, filter) {
    if (!filter || filter === 'all') return true;
    const actor = String(event.actorType || '').toLowerCase();
    const action = String(event.action || '').toUpperCase();

    if (['admin','client','agent','system'].includes(filter)) return actor === filter;
    if (filter === 'documents') return action.includes('DOCUMENT') || action.includes('DRIVE');
    if (filter === 'status') return action === 'STATUS_CHANGED';
    if (filter === 'financing') return action.includes('FINANCING') || action === 'CLIENT_DECISION';
    if (filter === 'notifications') return action.includes('NOTIFICATION');
    return true;
  }

  function detailFor(event) {
    const field = String(event.field || '');
    const hiddenFields = ['notes','messageBody'];
    if (hiddenFields.includes(field)) return '';

    const oldValue = String(event.oldValue ?? '').trim();
    const newValue = String(event.newValue ?? '').trim();

    if (event.action === 'DOCUMENT_UPLOADED' && newValue) {
      return 'File: ' + short(newValue, 180);
    }

    if (field && (oldValue || newValue)) {
      const from = oldValue || 'Not set';
      const to = newValue || 'Not set';
      return short(from, 100) + ' → ' + short(to, 100);
    }

    if (event.action === 'CLIENT_NOTIFICATION_FAILED' && event.metadata) {
      try {
        const metadata = JSON.parse(event.metadata);
        if (metadata?.error) return short(metadata.error, 180);
      } catch (_) {}
    }

    return '';
  }

  function actorLabel(event) {
    const type = String(event.actorType || 'SYSTEM').toUpperCase();
    const id = String(event.actorId || '').trim();
    if (type === 'ADMIN') return id ? 'Admin · ' + id : 'Admin';
    if (type === 'CLIENT') return id ? 'Client · ' + id : 'Client';
    if (type === 'AGENT') return id ? 'Agent · ' + id : 'Agent';
    return id ? 'System · ' + id : 'System';
  }

  function render() {
    const trail = $('#auditTrail');
    const count = $('#auditCount');
    if (!trail || !count) return;

    const filter = $('#auditFilter')?.value || 'all';
    const visible = events.filter(event => matchesFilter(event, filter));
    count.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;
    trail.replaceChildren();

    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'audit-empty';
      empty.textContent = events.length
        ? 'No activity matches this filter.'
        : 'No audit activity has been recorded for this application yet.';
      trail.appendChild(empty);
      return;
    }

    visible.forEach(event => {
      const item = document.createElement('div');
      const actorType = String(event.actorType || 'system').toLowerCase();
      item.className = 'audit-event ' + actorType;

      const dot = document.createElement('span');
      dot.className = 'audit-dot';

      const body = document.createElement('div');
      const line = document.createElement('div');
      line.className = 'audit-line';

      const summary = document.createElement('div');
      summary.className = 'audit-summary';
      summary.textContent = event.summary || String(event.action || 'Activity').replace(/_/g,' ');

      const time = document.createElement('time');
      time.className = 'audit-time';
      time.textContent = formatDate(event.timestamp);

      line.append(summary, time);
      body.appendChild(line);

      const detail = detailFor(event);
      if (detail) {
        const meta = document.createElement('div');
        meta.className = 'audit-meta';
        meta.textContent = detail;
        body.appendChild(meta);
      }

      const actor = document.createElement('span');
      actor.className = 'audit-actor';
      actor.textContent = actorLabel(event);
      body.appendChild(actor);

      item.append(dot, body);
      trail.appendChild(item);
    });
  }

  async function loadAudit(showLoading = true) {
    if (!currentApplicationId || loading) return;
    loading = true;

    const trail = $('#auditTrail');
    const refresh = $('#auditRefresh');
    if (showLoading && trail) {
      trail.innerHTML = '<div class="audit-empty">Loading application activity…</div>';
    }
    if (refresh) {
      refresh.disabled = true;
      refresh.textContent = 'Refreshing…';
    }

    try {
      const result = await jsonp('adminGetAudit', { applicationId:currentApplicationId });
      if (!result?.ok) throw new Error(result?.error || 'Audit history could not be loaded.');
      events = Array.isArray(result.data) ? result.data : [];
      render();
    } catch (error) {
      events = [];
      if (trail) {
        trail.replaceChildren();
        const empty = document.createElement('div');
        empty.className = 'audit-empty';
        empty.textContent = /Unknown action/i.test(error.message || '')
          ? 'Deploy the updated Apps Script to activate the audit trail.'
          : (error.message || 'Audit history could not be loaded.');
        trail.appendChild(empty);
      }
      if ($('#auditCount')) $('#auditCount').textContent = '0 events';
    } finally {
      loading = false;
      if (refresh) {
        refresh.disabled = false;
        refresh.textContent = 'Refresh Activity';
      }
    }
  }

  function setAuditOpen(open) {
    const card = $('#auditCard');
    const body = $('#auditBody');
    const toggle = $('#auditToggle');
    if (!card || !body || !toggle) return;

    card.classList.toggle('open',open);
    body.classList.toggle('hidden',!open);
    toggle.setAttribute('aria-expanded',String(open));

    if (open && currentApplicationId && !events.length && !loading) {
      loadAudit(true);
    }
  }

  function selectApplication(id) {
    const clean = String(id || '').trim();
    if (!/^TFC-/i.test(clean)) return;
    const changed = clean !== currentApplicationId;
    currentApplicationId = clean;
    if (changed) {
      events = [];
      render();
      setAuditOpen(false);
    }
    setTimeout(() => loadAudit(false), 180);
  }

  document.addEventListener('click', event => {
    const open = event.target.closest?.('[data-open]');
    if (open?.dataset?.open) selectApplication(open.dataset.open);
  }, true);

  const auditToggle = $('#auditToggle');
  if (auditToggle) {
    auditToggle.onclick = () => {
      const isOpen = $('#auditToggle')?.getAttribute('aria-expanded') === 'true';
      setAuditOpen(!isOpen);
    };
  }

  const auditRefresh = $('#auditRefresh');
  if (auditRefresh) auditRefresh.onclick = () => loadAudit(true);

  const auditFilter = $('#auditFilter');
  if (auditFilter) auditFilter.onchange = render;

  const title = $('#dTitle');
  if (title) {
    const titleObserver = new MutationObserver(() => {
      const match = String(title.textContent || '').match(/TFC-[A-Z0-9-]+/i);
      if (match) selectApplication(match[0]);
    });
    titleObserver.observe(title, { childList:true, subtree:true, characterData:true });
  }

  setAuditOpen(false);

  const saveMessage = $('#saveMsg');
  if (saveMessage) {
    const saveObserver = new MutationObserver(() => {
      if (/Saved successfully/i.test(String(saveMessage.textContent || ''))) {
        setTimeout(() => loadAudit(false), 500);
      }
    });
    saveObserver.observe(saveMessage, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class'] });
  }
})();


(() => {
  'use strict';

  if (window.__TFC_LENDER_SUBMISSIONS__) return;
  window.__TFC_LENDER_SUBMISSIONS__ = true;

  const cfg = window.TFC_CONFIG || {};
  const $ = selector => document.querySelector(selector);
  const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
  let currentApplicationId = '';
  let lenders = [];
  let documents = [];
  let editingLenderId = '';

  function adminToken() {
    return String(sessionStorage.getItem('tfc-admin-token') || '').trim();
  }

  function jsonp(action, payload = {}, timeout = 60000) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('CRM endpoint is not configured.'));
      const callback = `tfc_lender_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({ action, callback, _: String(Date.now()) });
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('The lender submission request timed out.'));
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
        reject(new Error('The lender submission service could not be reached.'));
      };

      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  function ensureUi() {
    if ($('#lenderSubmissionCard')) return;

    const style = document.createElement('style');
    style.id = 'lenderSubmissionStyles';
    style.textContent = `
      .lender-submit-card{margin-top:16px}
      .lender-submit-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      .lender-submit-head h3{margin:2px 0 0}
      .lender-manage{margin-top:14px;padding:14px;border:1px solid rgba(23,19,15,.12);border-radius:10px;background:#fbf7f0}
      .lender-manage.hidden{display:none}
      .lender-manage-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .lender-manage-grid .full{grid-column:1/-1}
      .lender-manage-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .lender-block{margin-top:16px}
      .lender-block-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
      .lender-block-head strong{font-size:10px;letter-spacing:.09em;text-transform:uppercase}
      .lender-checklist,.lender-docs{display:grid;gap:7px}
      .lender-option,.lender-doc-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid rgba(23,19,15,.11);border-radius:9px;padding:10px 11px;background:#fff}
      .lender-option input,.lender-doc-row input{width:16px;height:16px}
      .lender-option-main,.lender-doc-main{min-width:0}
      .lender-option-main strong,.lender-doc-main strong{display:block;font-size:11px;line-height:1.35}
      .lender-option-main small,.lender-doc-main small{display:block;color:#786f65;font-size:9px;line-height:1.45;margin-top:2px;overflow-wrap:anywhere}
      .lender-row-actions{display:flex;gap:5px}
      .lender-mini{border:1px solid #d9cdbf;background:#fbf7f0;border-radius:999px;padding:6px 9px;font-size:8px;text-transform:uppercase;letter-spacing:.06em;cursor:pointer}
      .lender-empty{padding:12px 0;color:#786f65;font-size:11px;line-height:1.5}
      .lender-compose{margin-top:16px;display:grid;gap:10px}
      .lender-compose label{display:block;font-size:9px;letter-spacing:.09em;text-transform:uppercase;margin-bottom:6px}
      .lender-compose input,.lender-compose textarea,.lender-manage input,.lender-manage textarea{width:100%;border:1px solid #d9cdbf;border-radius:8px;background:#fff;padding:11px;font-size:12px}
      .lender-compose textarea{min-height:150px;resize:vertical}
      .lender-package-meta{font-size:10px;color:#786f65}
      .lender-send-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}
      .lender-send-actions .btn{margin:0}
      .lender-status{font-size:11px;line-height:1.55;margin-top:10px;color:#786f65}
      .lender-status.success{color:#2f855a}
      .lender-status.error{color:#a13f33}
      @media(max-width:760px){.lender-manage-grid{grid-template-columns:1fr}.lender-manage-grid .full{grid-column:auto}.lender-option,.lender-doc-row{grid-template-columns:auto minmax(0,1fr)}.lender-row-actions{grid-column:2}}
    `;
    document.head.appendChild(style);

    const documentsSection = $('#documents')?.closest('.section');
    if (!documentsSection) return;

    const card = document.createElement('section');
    card.id = 'lenderSubmissionCard';
    card.className = 'section card lender-submit-card';
    card.innerHTML = `
      <div class="lender-submit-head">
        <div><div class="eyebrow">Lender Submission</div><h3>Send Client Package</h3></div>
        <button class="quick" id="lenderManageToggle" type="button">Manage Lenders</button>
      </div>

      <div class="lender-manage hidden" id="lenderManagePanel">
        <div class="lender-manage-grid">
          <div class="field"><label>Lender Name</label><input id="lenderName" maxlength="120" placeholder="Lender name"></div>
          <div class="field"><label>Submission Email</label><input id="lenderEmail" type="email" maxlength="180" placeholder="submissions@lender.com"></div>
          <div class="field"><label>Contact Name</label><input id="lenderContact" maxlength="120" placeholder="Optional"></div>
          <div class="field"><label>Notes</label><input id="lenderNotes" maxlength="240" placeholder="Optional internal note"></div>
        </div>
        <div class="lender-manage-actions">
          <button class="quick" id="lenderSave" type="button">Save Lender</button>
          <button class="quick hidden" id="lenderCancelEdit" type="button">Cancel Edit</button>
        </div>
        <div class="lender-status" id="lenderManageStatus"></div>
      </div>

      <div class="lender-block">
        <div class="lender-block-head"><strong>Select Lender(s)</strong><span class="subtle" id="lenderCount">0 saved</span></div>
        <div class="lender-checklist" id="lenderList"><div class="lender-empty">Loading lenders…</div></div>
      </div>

      <div class="lender-block">
        <div class="lender-block-head">
          <strong>Select Documents</strong>
          <button class="lender-mini" id="lenderSelectAll" type="button">Select All</button>
        </div>
        <div class="lender-docs" id="lenderDocs"><div class="lender-empty">Open a client file to load Drive documents.</div></div>
        <div class="lender-package-meta" id="lenderPackageMeta">0 documents selected</div>
      </div>

      <div class="lender-compose">
        <div><label>Email Subject</label><input id="lenderSubject" maxlength="180"></div>
        <div><label>Email Message</label><textarea id="lenderBody" maxlength="2000"></textarea></div>
        <div class="lender-package-meta">Use {Lender Name} and {Company Name}; they are personalized automatically for each lender.</div>
      </div>

      <div class="lender-send-actions">
        <button class="btn gold" id="lenderSend" type="button">Send Package</button>
        <span class="subtle">Each lender receives a separate email.</span>
      </div>
      <div class="lender-status" id="lenderSendStatus"></div>
    `;
    documentsSection.insertAdjacentElement('afterend',card);

    $('#lenderManageToggle').onclick = () => {
      $('#lenderManagePanel').classList.toggle('hidden');
    };
    $('#lenderSave').onclick = saveLender;
    $('#lenderCancelEdit').onclick = resetLenderForm;
    $('#lenderSelectAll').onclick = toggleAllDocuments;
    $('#lenderSend').onclick = sendPackage;
  }

  function formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (!Number.isFinite(n) || n <= 0) return '0 KB';
    if (n < 1024 * 1024) return Math.max(1,Math.round(n / 1024)) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function typeLabel(type) {
    const value = String(type || 'document');
    if (value === 'statement') return 'Bank Statement';
    if (value === 'identification') return 'Identification';
    if (value === 'financial') return 'Financial Statement';
    return 'Other Document';
  }

  function setStatus(selector,message,type='') {
    const el = $(selector);
    if (!el) return;
    el.className = 'lender-status' + (type ? ' ' + type : '');
    el.textContent = message || '';
  }

  function resetLenderForm() {
    editingLenderId = '';
    ['#lenderName','#lenderEmail','#lenderContact','#lenderNotes'].forEach(selector => {
      if ($(selector)) $(selector).value = '';
    });
    $('#lenderSave').textContent = 'Save Lender';
    $('#lenderCancelEdit').classList.add('hidden');
    setStatus('#lenderManageStatus','');
  }

  function editLender(id) {
    const lender = lenders.find(item => String(item.lenderId) === String(id));
    if (!lender) return;
    editingLenderId = lender.lenderId;
    $('#lenderName').value = lender.name || '';
    $('#lenderEmail').value = lender.email || '';
    $('#lenderContact').value = lender.contactName || '';
    $('#lenderNotes').value = lender.notes || '';
    $('#lenderSave').textContent = 'Update Lender';
    $('#lenderCancelEdit').classList.remove('hidden');
    $('#lenderManagePanel').classList.remove('hidden');
    $('#lenderName').focus();
  }

  function renderLenders() {
    const list = $('#lenderList');
    if (!list) return;
    list.replaceChildren();
    $('#lenderCount').textContent = lenders.length + ' saved';

    if (!lenders.length) {
      const empty = document.createElement('div');
      empty.className = 'lender-empty';
      empty.textContent = 'No lenders saved yet. Use Manage Lenders to add your first lender.';
      list.appendChild(empty);
      return;
    }

    lenders.forEach(lender => {
      const row = document.createElement('label');
      row.className = 'lender-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = lender.lenderId;
      checkbox.dataset.lenderChoice = 'true';

      const main = document.createElement('span');
      main.className = 'lender-option-main';
      const name = document.createElement('strong');
      name.textContent = lender.name || 'Lender';
      const detail = document.createElement('small');
      detail.textContent = [lender.contactName,lender.email].filter(Boolean).join(' · ');
      main.append(name,detail);

      const actions = document.createElement('span');
      actions.className = 'lender-row-actions';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'lender-mini';
      edit.textContent = 'Edit';
      edit.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        editLender(lender.lenderId);
      };

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'lender-mini';
      remove.textContent = 'Remove';
      remove.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        deleteLender(lender.lenderId,lender.name);
      };

      actions.append(edit,remove);
      row.append(checkbox,main,actions);
      list.appendChild(row);
    });
  }

  function renderDocuments() {
    const list = $('#lenderDocs');
    if (!list) return;
    list.replaceChildren();

    if (!documents.length) {
      const empty = document.createElement('div');
      empty.className = 'lender-empty';
      empty.textContent = 'No client documents are available in Drive yet.';
      list.appendChild(empty);
      updatePackageMeta();
      return;
    }

    documents.forEach(doc => {
      const row = document.createElement('label');
      row.className = 'lender-doc-row';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = doc.id;
      checkbox.dataset.lenderDocument = 'true';
      checkbox.checked = true;
      checkbox.onchange = updatePackageMeta;

      const main = document.createElement('span');
      main.className = 'lender-doc-main';
      const name = document.createElement('strong');
      name.textContent = doc.name || 'Document';
      const detail = document.createElement('small');
      detail.textContent = typeLabel(doc.type) + ' · ' + formatBytes(doc.size);
      main.append(name,detail);

      const badge = document.createElement('small');
      badge.textContent = formatBytes(doc.size);

      row.append(checkbox,main,badge);
      list.appendChild(row);
    });

    updatePackageMeta();
  }

  function updatePackageMeta() {
    const selected = [...document.querySelectorAll('[data-lender-document]:checked')];
    const selectedIds = new Set(selected.map(input => input.value));
    const chosenDocs = documents.filter(doc => selectedIds.has(String(doc.id)));
    const bytes = chosenDocs.reduce((sum,doc) => sum + Number(doc.size || 0),0);
    const tooLarge = bytes > MAX_PACKAGE_BYTES;

    $('#lenderPackageMeta').textContent =
      chosenDocs.length + ' document' + (chosenDocs.length === 1 ? '' : 's') +
      ' selected · ' + formatBytes(bytes) +
      (tooLarge ? ' · package too large for email' : '');

    $('#lenderPackageMeta').style.color = tooLarge ? '#a13f33' : '';
    $('#lenderSelectAll').textContent =
      documents.length && chosenDocs.length === documents.length ? 'Clear All' : 'Select All';
  }

  function toggleAllDocuments() {
    const inputs = [...document.querySelectorAll('[data-lender-document]')];
    if (!inputs.length) return;
    const allSelected = inputs.every(input => input.checked);
    inputs.forEach(input => { input.checked = !allSelected; });
    updatePackageMeta();
  }

  function defaultCompose() {
    $('#lenderSubject').value = '{Lender Name} LOC_{Company Name}';
    $('#lenderBody').value = [
      'Hi {Lender Name} Team',
      '',
      'Hope you are well.',
      '',
      'The client would like to apply for Small Business Financing.',
      'Please see the attached details',
      '1. Client Information',
      '2. Bank Statements',
      '',
      'Warm Regards',
      '',
      'Toronto Finance Company'
    ].join('\n');
  }

  async function loadLenders() {
    ensureUi();
    const token = adminToken();
    if (!token) {
      lenders = [];
      renderLenders();
      setStatus('#lenderSendStatus','Log out and log back in once to activate lender submissions.','error');
      return;
    }

    try {
      const result = await jsonp('adminListLenders',{ adminToken:token },30000);
      if (!result?.ok) throw new Error(result?.error || 'Lenders could not be loaded.');
      lenders = Array.isArray(result.data) ? result.data : [];
      renderLenders();
      setStatus('#lenderSendStatus','');
    } catch (error) {
      lenders = [];
      renderLenders();
      const message = /Unknown action/i.test(error.message || '')
        ? 'Deploy the updated Code_SIMPLE.gs Apps Script version to activate lender submissions.'
        : (error.message || 'Lenders could not be loaded.');
      setStatus('#lenderSendStatus',message,'error');
    }
  }

  async function loadDocuments() {
    ensureUi();
    if (!currentApplicationId) return;
    const token = adminToken();
    if (!token) return;

    $('#lenderDocs').innerHTML = '<div class="lender-empty">Loading client documents from Drive…</div>';
    try {
      const result = await jsonp('adminGetSubmissionDocuments',{
        adminToken:token,
        applicationId:currentApplicationId
      },30000);
      if (!result?.ok) throw new Error(result?.error || 'Client documents could not be loaded.');
      documents = Array.isArray(result.data) ? result.data : [];
      renderDocuments();
    } catch (error) {
      documents = [];
      renderDocuments();
      setStatus('#lenderSendStatus',error.message || 'Client documents could not be loaded.','error');
    }
  }

  async function saveLender() {
    const token = adminToken();
    if (!token) return setStatus('#lenderManageStatus','Please log out and log back in first.','error');

    const name = $('#lenderName').value.trim();
    const email = $('#lenderEmail').value.trim();
    const contactName = $('#lenderContact').value.trim();
    const notes = $('#lenderNotes').value.trim();

    if (!name) return setStatus('#lenderManageStatus','Enter the lender name.','error');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setStatus('#lenderManageStatus','Enter a valid submission email.','error');

    const button = $('#lenderSave');
    button.disabled = true;
    setStatus('#lenderManageStatus',editingLenderId ? 'Updating lender…' : 'Saving lender…');

    try {
      const result = await jsonp('adminSaveLender',{
        adminToken:token,
        lenderId:editingLenderId,
        name,
        email,
        contactName,
        notes
      },30000);
      if (!result?.ok) throw new Error(result?.error || 'Lender could not be saved.');
      resetLenderForm();
      await loadLenders();
      $('#lenderManagePanel').classList.remove('hidden');
      setStatus('#lenderManageStatus','Lender saved.','success');
    } catch (error) {
      setStatus('#lenderManageStatus',error.message || 'Lender could not be saved.','error');
    } finally {
      button.disabled = false;
    }
  }

  async function deleteLender(id,name) {
    if (!confirm(`Remove ${name || 'this lender'} from the saved lender list?`)) return;
    const token = adminToken();
    if (!token) return setStatus('#lenderManageStatus','Please log out and log back in first.','error');

    try {
      const result = await jsonp('adminDeleteLender',{
        adminToken:token,
        lenderId:id
      },30000);
      if (!result?.ok) throw new Error(result?.error || 'Lender could not be removed.');
      if (editingLenderId === id) resetLenderForm();
      await loadLenders();
      setStatus('#lenderManageStatus','Lender removed.','success');
    } catch (error) {
      setStatus('#lenderManageStatus',error.message || 'Lender could not be removed.','error');
    }
  }

  async function sendPackage() {
    const token = adminToken();
    if (!token) return setStatus('#lenderSendStatus','Please log out and log back in first.','error');
    if (!currentApplicationId) return setStatus('#lenderSendStatus','Open a client file first.','error');

    const lenderIds = [...document.querySelectorAll('[data-lender-choice]:checked')].map(input => input.value);
    const fileIds = [...document.querySelectorAll('[data-lender-document]:checked')].map(input => input.value);
    const subject = $('#lenderSubject').value.trim();
    const body = $('#lenderBody').value.trim();

    if (!lenderIds.length) return setStatus('#lenderSendStatus','Select at least one lender.','error');
    if (!fileIds.length) return setStatus('#lenderSendStatus','Select at least one document.','error');
    if (!subject) return setStatus('#lenderSendStatus','Enter an email subject.','error');
    if (!body) return setStatus('#lenderSendStatus','Enter an email message.','error');

    const selectedIds = new Set(fileIds);
    const totalBytes = documents.filter(doc => selectedIds.has(String(doc.id)))
      .reduce((sum,doc) => sum + Number(doc.size || 0),0);
    if (totalBytes > MAX_PACKAGE_BYTES) {
      return setStatus('#lenderSendStatus','Package is too large to email. Deselect one or more documents and try again.','error');
    }

    const button = $('#lenderSend');
    button.disabled = true;
    button.textContent = 'Sending…';
    setStatus('#lenderSendStatus',`Sending ${fileIds.length} document(s) to ${lenderIds.length} lender(s)…`);

    try {
      const result = await jsonp('adminSendLenderPackage',{
        adminToken:token,
        applicationId:currentApplicationId,
        lenderIds:JSON.stringify(lenderIds),
        fileIds:JSON.stringify(fileIds),
        subject,
        body
      },60000);

      if (!result?.ok) throw new Error(result?.error || 'The lender package could not be sent.');

      const sent = Array.isArray(result.sent) ? result.sent : [];
      const failed = Array.isArray(result.failed) ? result.failed : [];

      if (sent.length) {
        const names = sent.map(item => item.name || item.email).join(', ');
        const failureNote = failed.length ? ` ${failed.length} send(s) failed.` : '';
        setStatus(
          '#lenderSendStatus',
          `Sent successfully to ${names} with ${Number(result.documentCount || fileIds.length)} attachment(s).${failureNote}`,
          failed.length ? '' : 'success'
        );
        document.querySelectorAll('[data-lender-choice]:checked').forEach(input => { input.checked = false; });
        const auditRefresh = $('#auditRefresh');
        if (auditRefresh && !auditRefresh.disabled) setTimeout(() => auditRefresh.click(),500);
      } else {
        const firstError = failed[0]?.error || 'No lender emails were sent.';
        setStatus('#lenderSendStatus',firstError,'error');
      }
    } catch (error) {
      setStatus('#lenderSendStatus',error.message || 'The lender package could not be sent.','error');
    } finally {
      button.disabled = false;
      button.textContent = 'Send Package';
    }
  }

  function selectApplication(id) {
    const clean = String(id || '').trim();
    if (!/^TFC-/i.test(clean)) return;
    const changed = clean !== currentApplicationId;
    currentApplicationId = clean;
    ensureUi();
    if (changed) {
      documents = [];
      renderDocuments();
      defaultCompose();
    }
    loadLenders();
    loadDocuments();
  }

  document.addEventListener('click',event => {
    const open = event.target.closest?.('[data-open]');
    if (open?.dataset?.open) setTimeout(() => selectApplication(open.dataset.open),120);
  },true);

  function install() {
    ensureUi();
    const title = $('#dTitle');
    if (!title) return;
    const observer = new MutationObserver(() => {
      const match = String(title.textContent || '').match(/TFC-[A-Z0-9-]+/i);
      if (match) selectApplication(match[0]);
    });
    observer.observe(title,{ childList:true,subtree:true,characterData:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{ once:true });
  else install();
})();
