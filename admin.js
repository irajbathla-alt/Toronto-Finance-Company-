(() => {
  'use strict';

  const cfg = window.TFC_CONFIG || {};
  const minimumStatements = Number(cfg.minimumStatements || 6);
  const DEFAULT_TIMEOUT = Number(cfg.requestTimeout || 30000);
  const $ = selector => document.querySelector(selector);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const isTrue = value => value === true || ['true','1','yes'].includes(String(value || '').trim().toLowerCase());
  const adminToken = () => String(sessionStorage.getItem('tfc-admin-token') || '').trim();
  let applications = [];
  let selected = null;

  const PRESETS = {
    'Statements Required': ['Bank Statements Required', 'Please upload your six most recent monthly business bank statements so we can continue reviewing your application.'],
    'Ready for Review': ['Documents Received', 'Thank you. Your required documents have been received and your application is ready for review.'],
    'Under Review': ['Application Under Review', 'Your application is currently under review. No action is required unless your advisor contacts you for additional information.'],
    'Additional Documents Required': ['Additional Documents Required', 'We require additional information to continue reviewing your application. Please review the requested documents in your client portal and upload them securely.'],
    'Conditional Approval': ['Conditional Financing Available', 'Financing terms are available for your review in the client portal. Please review the details and choose Proceed or Request More Information. Any financing shown is indicative only and is not a commitment to lend. Final financing remains subject to lender review, underwriting, documentation, conditions and final agreements.'],
    'Approved': ['Financing Available', 'Financing terms are available for your review in the client portal. Please review the details and choose Proceed or Request More Information. Any financing shown is indicative only and is not a commitment to lend. Final financing remains subject to lender review, underwriting, documentation, conditions and final agreements.'],
    'Funded': ['Financing Completed', 'Your financing file has been completed. Thank you for choosing Toronto Finance Company.'],
    'Declined': ['Application Update', 'We have an update regarding your financing application. Please contact your advisor to discuss the available next steps.']
  };

  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2400);
  }

  function jsonp(action, payload = {}, mode = 'direct', timeout = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('CRM endpoint is not configured.'));
      const callback = `tfc_admin_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({ action, callback, _: String(Date.now()) });

      if (mode === 'payload') {
        params.set('payload', JSON.stringify({ action, ...payload }));
      } else {
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== undefined && value !== null) params.set(key, String(value));
        });
      }

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('CRM request timed out while Google Apps Script was starting.'));
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
        reject(new Error('CRM endpoint could not be reached.'));
      };

      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function readApi(action, payload = {}, timeout = DEFAULT_TIMEOUT) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await sleep(1200);
      for (const mode of ['direct', 'payload']) {
        try {
          const result = await jsonp(action, payload, mode, timeout);
          if (result) return result;
        } catch (error) {
          lastError = error;
        }
      }
    }
    throw lastError || new Error('CRM endpoint could not be reached.');
  }

  function statusClass(status = '') {
    if (['Approved', 'Funded', 'Conditional Approval'].includes(status)) return 'approved';
    if (status === 'Declined') return 'declined';
    if (status === 'Under Review') return 'review';
    if (['Ready for Review', 'Statements Required', 'Additional Documents Required'].includes(status)) return 'ready';
    return '';
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[character]));
  }

  function render() {
    const query = $('#search').value.trim().toLowerCase();
    const filter = $('#filter').value;
    const data = applications.filter(app => {
      const text = [app.applicationId, app.name, app.email, app.business, app.advisor, app.clientDecision].join(' ').toLowerCase();
      return (!filter || app.status === filter) && (!query || text.includes(query));
    });

    $('#rows').innerHTML = data.map(app => {
      const appId = escapeHtml(app.applicationId || '—');
      const name = escapeHtml(app.name || 'Unnamed client');
      const email = escapeHtml(app.email || '');
      const business = app.business ? escapeHtml(app.business) : '<span class="subtle">Not provided</span>';
      const status = escapeHtml(app.status || 'Account Created');
      const decision = app.clientDecision ? `<div class="subtle" style="margin-top:5px">Client: ${escapeHtml(app.clientDecision)}</div>` : '';
      const advisor = app.advisor ? escapeHtml(app.advisor) : '<span class="subtle">Unassigned</span>';
      return `
      <tr>
        <td><strong>${appId}</strong><div class="subtle">${escapeHtml(formatDate(app.created))}</div></td>
        <td><strong>${name}</strong><div class="subtle">${email}</div></td>
        <td>${business}</td>
        <td><span class="status ${statusClass(app.status)}">${status}</span>${decision}</td>
        <td>${Number(app.statements || 0)}/${minimumStatements}</td>
        <td>${advisor}</td>
        <td>${escapeHtml(formatDate(app.updated))}</td>
        <td><button class="quick" data-open="${escapeHtml(app.applicationId || '')}">Open File</button></td>
      </tr>`;
    }).join('');

    $('#empty').classList.toggle('hidden', Boolean(data.length));
    document.querySelectorAll('[data-open]').forEach(button => button.onclick = () => openFile(button.dataset.open));
    $('#mAll').textContent = applications.length;
    $('#mAction').textContent = applications.filter(app => Number(app.statements || 0) < minimumStatements || ['Account Created', 'Statements Required', 'Additional Documents Required'].includes(app.status)).length;
    $('#mReady').textContent = applications.filter(app => app.status === 'Ready for Review').length;
    $('#mReview').textContent = applications.filter(app => app.status === 'Under Review').length;
    $('#mDecision').textContent = applications.filter(app => ['Conditional Approval', 'Approved', 'Funded', 'Declined'].includes(app.status)).length;
  }

  async function load(showToast = false) {
    const selectedId = selected?.applicationId || '';
    const drawerWasOpen = $('#drawer')?.classList.contains('show');
    $('#refresh').disabled = true;
    try {
      const result = await readApi('adminList', { adminToken:adminToken() });
      if (!result?.ok) throw new Error(result?.error || 'Could not load applications.');
      applications = result.data || [];
      render();

      if (selectedId && drawerWasOpen) {
        const freshSelected = applications.find(app => String(app.applicationId) === String(selectedId));
        if (freshSelected) openFile(selectedId);
        else closeDrawer();
      }

      $('#lastSync').textContent = `Last refreshed ${new Date().toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}`;
      if (showToast) toast('Applications refreshed');
      return true;
    } catch (error) {
      const message = error?.message || 'Could not load applications.';
      if (/admin session expired/i.test(message)) {
        sessionStorage.removeItem('tfc-admin-token');
        $('#admin').classList.add('hidden');
        $('#login').classList.remove('hidden');
        $('#logoutBtn').classList.add('hidden');
        $('#loginMsg').className = 'notice error';
        $('#loginMsg').textContent = 'Your admin session expired. Please log in again.';
      } else {
        toast(message);
      }
      return false;
    } finally {
      $('#refresh').disabled = false;
    }
  }

  function renderDocs(docs = []) {
    $('#documentCount').textContent = `${docs.length} file${docs.length === 1 ? '' : 's'}`;
    $('#documents').innerHTML = docs.length
      ? docs.map(doc => `<li><span>${escapeHtml(doc.name || 'Document')}</span><span>${escapeHtml(formatDate(doc.date || doc.created))}</span></li>`).join('')
      : '<li><span class="subtle">No documents uploaded yet.</span></li>';
  }

  async function loadDocuments(applicationId) {
    $('#documentCount').textContent = 'Loading…';
    try {
      const result = await readApi('getDocuments', { applicationId, adminToken:adminToken() });
      renderDocs(result?.ok ? result.data || [] : []);
    } catch (_) {
      renderDocs([]);
    }
  }

  function updateDriveButton() {
    $('#drive').textContent = selected?.driveUrl ? 'Open Drive Folder' : 'Create & Open Drive Folder';
  }

  function parseChatHistoryValue(value) {
    if (Array.isArray(value)) return value;
    const raw = String(value || '').trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function renderAdminConversation(record) {
    const box = $('#adminConversation');
    if (!box) return;
    box.replaceChildren();

    const history = parseChatHistoryValue(record?.chatHistory);
    if (!history.length) {
      const fallback = [];
      if (record?.messageBody || record?.messageTitle) fallback.push({ sender:'ADVISOR', message:record.messageBody || record.messageTitle });
      if (record?.clientDecisionNote) fallback.push({ sender:'CLIENT', message:record.clientDecisionNote, at:record.clientDecisionAt });
      history.push(...fallback);
    }

    if (!history.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-chat-empty';
      empty.textContent = 'No conversation yet.';
      box.appendChild(empty);
      return;
    }

    history.forEach(entry => {
      const row = document.createElement('div');
      const sender = String(entry.sender || 'ADVISOR').toUpperCase();
      row.className = 'admin-chat-row' + (sender === 'CLIENT' ? ' client' : '');
      const meta = document.createElement('small');
      meta.textContent = sender === 'CLIENT' ? 'Client' : 'Advisor';
      const message = document.createElement('div');
      message.textContent = entry.message || '';
      row.append(meta,message);
      box.appendChild(row);
    });
  }

  function renderClientResponse(record) {
    const box = $('#clientResponse');
    if (!box) return;
    box.replaceChildren();
    const heading = document.createElement('strong');
    const note = document.createElement('p');
    if (!record?.clientDecision) {
      box.className = 'client-response';
      heading.textContent = 'Awaiting Response';
      note.textContent = 'When the client chooses Proceed or Request More Information, the response will appear here.';
      box.append(heading, note);
      return;
    }
    box.className = 'client-response has-response';
    heading.textContent = record.clientDecision;
    note.textContent = record.clientDecisionNote || 'No additional note from the client.';
    box.append(heading, note);
    if (record.clientDecisionAt) {
      const received = document.createElement('p');
      received.textContent = `Received ${formatDate(record.clientDecisionAt)}`;
      box.append(received);
    }
  }

  function openFile(id) {
    selected = applications.find(app => String(app.applicationId) === String(id));
    if (!selected) return;
    $('#drawer').classList.add('show');
    $('#backdrop').classList.add('show');
    $('#dTitle').textContent = `${selected.applicationId || 'Application'} · ${selected.business || selected.name || 'Client'}`;
    $('#summaryStatus').textContent = selected.status || 'Account Created';
    $('#summaryStatements').textContent = `${Number(selected.statements || 0)} / ${minimumStatements}`;
    $('#summaryAdvisor').textContent = selected.advisor || 'Unassigned';
    $('#details').innerHTML = [
      ['Client', selected.name],
      ['Email', selected.email],
      ['Phone', selected.phone]
    ].map(([key, value]) => `<div class="kv"><b>${escapeHtml(key)}</b><span>${escapeHtml(value || '—')}</span></div>`).join('') +
    `<div class="kv business-kv">
      <b>Business</b>
      <span>
        <span class="business-inline">
          <input id="business" maxlength="180" value="${escapeHtml(selected.business || '')}" placeholder="Enter business name">
          <button class="quick" id="saveBusiness" type="button">Save</button>
        </span>
        <small id="businessSaveMsg" class="business-save-msg">Used on lender submissions.</small>
      </span>
    </div>` +
    [
      ['Requested Amount', selected.requested ? `CA${Number(selected.requested).toLocaleString()}` : '—'],
      ['Created', formatDate(selected.created)],
      ['Updated', formatDate(selected.updated)]
    ].map(([key, value]) => `<div class="kv"><b>${escapeHtml(key)}</b><span>${escapeHtml(value || '—')}</span></div>`).join('');

    ['status', 'advisor', 'approvedAmount', 'quote', 'term', 'paymentFrequency', 'paymentAmount', 'numberPayments', 'totalRepayment', 'documentsRequested', 'notes'].forEach(key => {
      const field = $('#' + key);
      if (field) field.value = selected[key] || '';
    });
    if ($('#messageBody')) $('#messageBody').value = '';
    if ($('#messageSendMsg')) {
      $('#messageSendMsg').className = 'notice';
      $('#messageSendMsg').textContent = '';
    }
    const additionalDocsToggle = $('#additionalDocsEnabled');
    if (additionalDocsToggle) additionalDocsToggle.checked = isTrue(selected.additionalDocsEnabled);

    const businessInput = $('#business');
    const businessSave = $('#saveBusiness');
    if (businessSave) businessSave.onclick = saveBusinessName;
    if (businessInput) businessInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveBusinessName();
      }
    });
    renderAdminConversation(selected);
    renderClientResponse(selected);
    updateDriveButton();
    loadDocuments(selected.applicationId);
  }

  function closeDrawer() {
    $('#drawer').classList.remove('show');
    $('#backdrop').classList.remove('show');
    selected = null;
  }

  async function saveBusinessName() {
    if (!selected) return;
    const business = $('#business')?.value.trim() || '';
    const button = $('#saveBusiness');
    const message = $('#businessSaveMsg');

    if (!business) {
      if (message) {
        message.className = 'business-save-msg error';
        message.textContent = 'Please enter the business name.';
      }
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Saving…';
    }
    if (message) {
      message.className = 'business-save-msg';
      message.textContent = 'Saving business name…';
    }

    try {
      const result = await readApi('adminUpdate', {
        applicationId:selected.applicationId,
        business,
        adminToken:adminToken()
      },35000);
      if (!result?.ok) throw new Error(result?.error || 'Business name could not be saved.');

      selected = result.data || { ...selected,business,updated:new Date().toISOString() };
      const index = applications.findIndex(app => String(app.applicationId) === String(selected.applicationId));
      if (index >= 0) applications[index] = selected;

      render();
      openFile(selected.applicationId);

      if (message) {
        message.className = 'business-save-msg success';
        message.textContent = 'Business name saved. Lender emails will use this company name.';
      }
      toast('Business name saved');
    } catch (error) {
      if (message) {
        message.className = 'business-save-msg error';
        message.textContent = error.message || 'Business name could not be saved.';
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Save';
      }
    }
  }

  async function saveUpdate() {
    if (!selected) return;
    const update = { applicationId: selected.applicationId, adminToken:adminToken() };
    ['business', 'status', 'advisor', 'approvedAmount', 'quote', 'term', 'paymentFrequency', 'paymentAmount', 'numberPayments', 'totalRepayment', 'documentsRequested', 'notes'].forEach(key => {
      const field = $('#' + key);
      if (field) update[key] = field.value;
    });
    update.additionalDocsEnabled = $('#additionalDocsEnabled')?.checked ? 'true' : 'false';

    $('#save').disabled = true;
    $('#save').textContent = 'Saving…';
    $('#saveMsg').className = 'notice';
    $('#saveMsg').textContent = 'Saving directly to CRM…';

    try {
      const result = await readApi('adminUpdate', update, 35000);
      if (!result?.ok) throw new Error(result?.error || 'The client update could not be saved.');
      selected = result.data || { ...selected, ...update, updated: new Date().toISOString() };
      const index = applications.findIndex(app => String(app.applicationId) === String(selected.applicationId));
      if (index >= 0) applications[index] = selected;
      render();
      openFile(selected.applicationId);
      $('#saveMsg').className = 'notice success';
      $('#saveMsg').textContent = result.notification?.attempted && !result.notification?.sent
        ? `Saved successfully. Email alert could not be sent: ${result.notification.error || 'email service unavailable.'}`
        : 'Saved successfully. The client portal has been updated.';
      toast('Client update saved');
    } catch (error) {
      $('#saveMsg').className = 'notice error';
      $('#saveMsg').textContent = error.message || 'Could not save the client update.';
    } finally {
      $('#save').disabled = false;
      $('#save').textContent = 'Save Client Update';
    }
  }

  async function openDrive() {
    if (!selected) return;
    if (selected.driveUrl) return window.open(selected.driveUrl, '_blank', 'noopener');
    $('#drive').disabled = true;
    $('#drive').textContent = 'Creating Folder…';
    try {
      const result = await readApi('adminEnsureDrive', { applicationId: selected.applicationId, adminToken:adminToken() }, 35000);
      if (!result?.ok || !result.data?.driveUrl) throw new Error(result?.error || 'Drive folder could not be created.');
      selected = result.data;
      const index = applications.findIndex(app => String(app.applicationId) === String(selected.applicationId));
      if (index >= 0) applications[index] = selected;
      updateDriveButton();
      window.open(selected.driveUrl, '_blank', 'noopener');
    } catch (error) {
      toast(error.message);
    } finally {
      $('#drive').disabled = false;
      updateDriveButton();
    }
  }

  async function login() {
    const email = $('#adminEmail').value.trim();
    const password = $('#adminPassword').value;
    $('#adminLogin').disabled = true;
    $('#loginMsg').className = 'notice';
    $('#loginMsg').textContent = 'Connecting to CRM…';
    try {
      const result = await readApi('adminLogin', { email, password });
      if (!result?.ok) throw new Error(result?.error || 'Login failed.');
      if (result.adminToken) sessionStorage.setItem('tfc-admin-token', result.adminToken);
      $('#login').classList.add('hidden');
      $('#admin').classList.remove('hidden');
      $('#logoutBtn').classList.remove('hidden');
      $('#loginMsg').textContent = '';
      await load();
    } catch (error) {
      $('#loginMsg').className = 'notice error';
      $('#loginMsg').textContent = error.message;
    } finally {
      $('#adminLogin').disabled = false;
    }
  }

  $('#adminLogin').onclick = login;
  $('#adminPassword').addEventListener('keydown', event => { if (event.key === 'Enter') login(); });
  $('#save').onclick = saveUpdate;
  $('#drive').onclick = openDrive;
  $('#refresh').onclick = () => load(true);
  $('#search').oninput = render;
  $('#filter').onchange = render;
  $('#clearFilters').onclick = () => { $('#search').value = ''; $('#filter').value = ''; render(); };
  $('#copyId').onclick = () => selected?.applicationId && navigator.clipboard?.writeText(selected.applicationId).then(() => toast('Application ID copied'));
  document.querySelectorAll('[data-status]').forEach(button => button.onclick = () => {
    if (!selected) return;
    $('#status').value = button.dataset.status;
    const preset = PRESETS[button.dataset.status];
    if (preset && $('#messageBody')) {
      $('#messageBody').value = preset[1];
    }
    toast(`Stage set to ${button.dataset.status}`);
  });
  $('#close').onclick = closeDrawer;
  $('#backdrop').onclick = closeDrawer;
  $('#websiteLink').onclick = () => location.href = 'index.html';
  $('#portalLink').onclick = () => location.href = 'client-dashboard.html?login=1';
  $('#logoutBtn').onclick = () => {
    sessionStorage.removeItem('tfc-admin-token');
    location.reload();
  };

  async function resumeAdminSession() {
    if (!adminToken()) return;
    $('#login').classList.add('hidden');
    $('#admin').classList.remove('hidden');
    $('#logoutBtn').classList.remove('hidden');
    $('#loginMsg').textContent = '';
    await load(false);
  }

  resumeAdminSession();
})();