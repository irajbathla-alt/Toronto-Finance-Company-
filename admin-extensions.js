(() => {
  'use strict';

  const cfg = window.TFC_CONFIG || {};
  const $ = selector => document.querySelector(selector);
  const FIELDS = [
    'status','advisor','messageTitle','messageBody','approvedAmount','quote','term',
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