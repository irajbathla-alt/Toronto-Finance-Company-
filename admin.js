(() => {
  'use strict';

  const cfg = window.TFC_CONFIG || {};
  const minimumStatements = Number(cfg.minimumStatements || 6);
  const $ = selector => document.querySelector(selector);
  let applications = [];
  let selected = null;

  const PRESETS = {
    'Statements Required': ['Bank Statements Required', 'Please upload your six most recent monthly business bank statements so we can continue reviewing your application.'],
    'Ready for Review': ['Documents Received', 'Thank you. Your required documents have been received and your application is ready for review.'],
    'Under Review': ['Application Under Review', 'Your application is currently under review. No action is required unless your advisor contacts you for additional information.'],
    'Additional Documents Required': ['Additional Documents Required', 'We require additional information to continue reviewing your application. Please contact your advisor or provide the requested documents.'],
    'Conditional Approval': ['Conditional Approval Available', 'A conditional financing approval is available. Please review the update and contact your advisor regarding the outstanding conditions.'],
    'Approved': ['Financing Approved', 'Your financing application has been approved. Please review the approval details and contact your advisor for the next steps.'],
    'Funded': ['Financing Completed', 'Your financing file has been completed. Thank you for choosing Toronto Finance Company.'],
    'Declined': ['Application Update', 'We have an update regarding your financing application. Please contact your advisor to discuss the available next steps.']
  };

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  function jsonpAt(url, action, payload = {}, mode = 'direct', timeout = 12000) {
    return new Promise((resolve, reject) => {
      if (!url) return reject(new Error('CRM endpoint is not configured.'));
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
        reject(new Error('CRM request timed out.'));
      }, timeout);
      function cleanup() {
        clearTimeout(timer);
        delete window[callback];
        script.remove();
      }
      window[callback] = data => {
        cleanup();
        resolve(data);
      };
      script.onerror = () => {
        cleanup();
        reject(new Error('CRM endpoint could not be reached.'));
      };
      script.src = `${url}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  function urls() {
    return [...new Set([cfg.apiUrl, cfg.apiFallbackUrl].filter(Boolean))];
  }

  async function readApi(action, payload = {}, timeout = 12000) {
    let lastError;
    for (const url of urls()) {
      for (const mode of ['direct', 'payload']) {
        try {
          const result = await jsonpAt(url, action, payload, mode, timeout);
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

  function render() {
    const query = $('#search').value.trim().toLowerCase();
    const filter = $('#filter').value;
    const data = applications.filter(app => {
      const text = [app.applicationId, app.name, app.email, app.business, app.advisor].join(' ').toLowerCase();
      return (!filter || app.status === filter) && (!query || text.includes(query));
    });

    $('#rows').innerHTML = data.map(app => `
      <tr>
        <td><strong>${app.applicationId || '—'}</strong><div class="subtle">${formatDate(app.created)}</div></td>
        <td><strong>${app.name || 'Unnamed client'}</strong><div class="subtle">${app.email || ''}</div></td>
        <td>${app.business || '<span class="subtle">Not provided</span>'}</td>
        <td><span class="status ${statusClass(app.status)}">${app.status || 'Account Created'}</span></td>
        <td>${Number(app.statements || 0)}/${minimumStatements}</td>
        <td>${app.advisor || '<span class="subtle">Unassigned</span>'}</td>
        <td>${formatDate(app.updated)}</td>
        <td><button class="quick" data-open="${app.applicationId}">Open File</button></td>
      </tr>`).join('');

    $('#empty').classList.toggle('hidden', Boolean(data.length));
    document.querySelectorAll('[data-open]').forEach(button => button.onclick = () => openFile(button.dataset.open));
    $('#mAll').textContent = applications.length;
    $('#mAction').textContent = applications.filter(app => Number(app.statements || 0) < minimumStatements || ['Account Created', 'Statements Required', 'Additional Documents Required'].includes(app.status)).length;
    $('#mReady').textContent = applications.filter(app => app.status === 'Ready for Review').length;
    $('#mReview').textContent = applications.filter(app => app.status === 'Under Review').length;
    $('#mDecision').textContent = applications.filter(app => ['Conditional Approval', 'Approved', 'Funded', 'Declined'].includes(app.status)).length;
  }

  async function load(showToast = false) {
    $('#refresh').disabled = true;
    try {
      const result = await readApi('adminList', {}, 15000);
      if (!result?.ok) throw new Error(result?.error || 'Could not load applications.');
      applications = result.data || [];
      render();
      $('#lastSync').textContent = `Last refreshed ${new Date().toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}`;
      if (showToast) toast('Applications refreshed');
    } catch (error) {
      toast(error.message);
    } finally {
      $('#refresh').disabled = false;
    }
  }

  function renderDocs(docs = []) {
    $('#documentCount').textContent = `${docs.length} file${docs.length === 1 ? '' : 's'}`;
    $('#documents').innerHTML = docs.length
      ? docs.map(doc => `<li><span>${doc.name || 'Document'}</span><span>${formatDate(doc.date || doc.created)}</span></li>`).join('')
      : '<li><span class="subtle">No documents uploaded yet.</span></li>';
  }

  async function loadDocuments(applicationId) {
    $('#documentCount').textContent = 'Loading…';
    try {
      const result = await readApi('getDocuments', { applicationId }, 15000);
      renderDocs(result?.ok ? result.data || [] : []);
    } catch (_) {
      renderDocs([]);
    }
  }

  function updatePreview() {
    $('#previewTitle').textContent = $('#messageTitle').value || 'Welcome';
    $('#previewBody').textContent = $('#messageBody').value || 'Your advisor message will appear here.';
  }

  function updateDriveButton() {
    $('#drive').textContent = selected?.driveUrl ? 'Open Drive Folder' : 'Create & Open Drive Folder';
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
      ['Client', selected.name], ['Email', selected.email], ['Phone', selected.phone], ['Business', selected.business],
      ['Requested Amount', selected.requested ? `CA$${Number(selected.requested).toLocaleString()}` : '—'],
      ['Created', formatDate(selected.created)], ['Updated', formatDate(selected.updated)]
    ].map(([key, value]) => `<div class="kv"><b>${key}</b><span>${value || '—'}</span></div>`).join('');
    ['status', 'advisor', 'messageTitle', 'messageBody', 'approvedAmount', 'quote', 'notes'].forEach(key => $('#' + key).value = selected[key] || '');
    updatePreview();
    updateDriveButton();
    loadDocuments(selected.applicationId);
  }

  function closeDrawer() {
    $('#drawer').classList.remove('show');
    $('#backdrop').classList.remove('show');
    selected = null;
  }

  async function saveUpdate() {
    if (!selected) return;
    const update = { applicationId: selected.applicationId };
    ['status', 'advisor', 'messageTitle', 'messageBody', 'approvedAmount', 'quote', 'notes'].forEach(key => update[key] = $('#' + key).value);

    $('#save').disabled = true;
    $('#save').textContent = 'Saving…';
    $('#saveMsg').className = 'notice';
    $('#saveMsg').textContent = 'Saving directly to CRM…';

    try {
      const result = await readApi('adminUpdate', update, 25000);
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
      const result = await readApi('adminEnsureDrive', { applicationId: selected.applicationId }, 25000);
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
    $('#loginMsg').textContent = 'Signing in…';
    try {
      const result = await readApi('adminLogin', { email, password }, 15000);
      if (!result?.ok) throw new Error(result?.error || 'Login failed.');
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
  $('#messageTitle').oninput = updatePreview;
  $('#messageBody').oninput = updatePreview;
  $('#copyId').onclick = () => selected?.applicationId && navigator.clipboard?.writeText(selected.applicationId).then(() => toast('Application ID copied'));
  document.querySelectorAll('[data-status]').forEach(button => button.onclick = () => {
    if (!selected) return;
    $('#status').value = button.dataset.status;
    const preset = PRESETS[button.dataset.status];
    if (preset) {
      $('#messageTitle').value = preset[0];
      $('#messageBody').value = preset[1];
      updatePreview();
    }
    toast(`Stage set to ${button.dataset.status}`);
  });
  $('#close').onclick = closeDrawer;
  $('#backdrop').onclick = closeDrawer;
  $('#websiteLink').onclick = () => location.href = 'index.html';
  $('#portalLink').onclick = () => location.href = 'client-dashboard.html?login=1';
  $('#logoutBtn').onclick = () => location.reload();
})();