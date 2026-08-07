(() => {
  'use strict';

  const CRM = window.TFC_CRM;
  const cfg = window.TFC_CONFIG || {};
  const minStatements = Number(cfg.minimumStatements || 6);
  const $ = selector => document.querySelector(selector);

  const STAGES = [
    'Account Created','Statements Required','Ready for Review','Under Review',
    'Additional Documents Required','Conditional Approval','Approved','Funded','Declined'
  ];
  const PIPELINE = ['Account Created','Statements Required','Ready for Review','Under Review','Conditional Approval','Approved','Funded'];
  const PRESETS = {
    'Statements Required':['Bank Statements Required','Please upload your six most recent monthly business bank statements so we can continue reviewing your financing application.'],
    'Ready for Review':['Documents Received','Thank you. Your required documents have been received and your financing application is ready for review.'],
    'Under Review':['Application Under Review','Your financing application is currently under review. We will update your dashboard if any additional information is required.'],
    'Additional Documents Required':['Additional Documents Required','Additional information is required to continue reviewing your application. Please review your advisor’s instructions and provide the requested documents.'],
    'Conditional Approval':['Conditional Approval Available','A conditional financing approval is available. Please review the approval information and your advisor’s message in the client dashboard.'],
    'Approved':['Financing Approval Available','Your financing approval is available for review. Please review the approved amount, product terms and next steps in your client dashboard.'],
    'Funded':['Financing Completed','Your financing file has been completed. Please contact your advisor if you require any additional assistance.'],
    'Declined':['Application Update','There is an important update regarding your financing application. Please review your dashboard and contact your advisor to discuss available next steps.']
  };

  let applications = [];
  let selected = null;
  let activeChip = '';

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2300);
  }

  function money(value) {
    const n = Number(value || 0);
    return n ? `CA$${n.toLocaleString('en-CA')}` : '—';
  }

  function date(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-CA',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }

  function statusClass(status='') {
    if (['Approved','Funded','Conditional Approval'].includes(status)) return 'approved';
    if (status === 'Declined') return 'declined';
    if (status === 'Under Review') return 'review';
    if (['Ready for Review','Statements Required','Additional Documents Required'].includes(status)) return 'ready';
    return '';
  }

  function matchesChip(a) {
    if (!activeChip) return true;
    if (activeChip === 'action') return Number(a.statements||0) < minStatements || ['Statements Required','Additional Documents Required','Account Created'].includes(a.status);
    if (activeChip === 'ready') return a.status === 'Ready for Review';
    if (activeChip === 'review') return a.status === 'Under Review';
    if (activeChip === 'decision') return ['Conditional Approval','Approved','Funded','Declined'].includes(a.status);
    return true;
  }

  function renderMetrics() {
    $('#mAll').textContent = applications.length;
    $('#mAction').textContent = applications.filter(a => Number(a.statements||0) < minStatements || ['Statements Required','Additional Documents Required','Account Created'].includes(a.status)).length;
    $('#mReady').textContent = applications.filter(a => a.status === 'Ready for Review').length;
    $('#mReview').textContent = applications.filter(a => a.status === 'Under Review').length;
    $('#mDecision').textContent = applications.filter(a => ['Conditional Approval','Approved','Funded','Declined'].includes(a.status)).length;
  }

  function render() {
    const q = $('#search').value.trim().toLowerCase();
    const filter = $('#filter').value;
    const data = applications.filter(a => {
      const text = [a.applicationId,a.name,a.email,a.business,a.advisor,a.status].join(' ').toLowerCase();
      return (!filter || a.status === filter) && (!q || text.includes(q)) && matchesChip(a);
    });

    $('#rows').innerHTML = data.map(a => {
      const n = Number(a.statements || 0);
      const pct = Math.min(100,n/minStatements*100);
      return `<tr>
        <td><strong>${a.applicationId||'—'}</strong><div class="subtle">${date(a.created)}</div></td>
        <td class="client"><strong>${a.name||'Unnamed client'}</strong><small>${a.email||''}</small></td>
        <td>${a.business||'<span class="subtle">Not provided</span>'}</td>
        <td><span class="status ${statusClass(a.status)}">${a.status||'Account Created'}</span></td>
        <td><strong>${n}/${minStatements}</strong><div class="mini-progress"><i style="width:${pct}%"></i></div></td>
        <td>${a.advisor||'<span class="subtle">Unassigned</span>'}</td>
        <td>${date(a.updated)}</td>
        <td><button class="btn secondary small open-file" data-id="${a.applicationId}">Open File</button></td>
      </tr>`;
    }).join('');

    $('#empty').classList.toggle('hidden', data.length > 0);
    document.querySelectorAll('.open-file').forEach(btn => btn.onclick = () => openFile(btn.dataset.id));
    renderMetrics();
  }

  async function load(showToast=false) {
    $('#refresh').disabled = true;
    $('#refresh').textContent = 'Refreshing...';
    try {
      const result = await CRM.get('adminList');
      applications = result.data || [];
      render();
      $('#lastSync').textContent = `Last refreshed ${new Date().toLocaleTimeString('en-CA',{hour:'numeric',minute:'2-digit'})}`;
      if (showToast) toast('Applications refreshed');
    } catch (error) {
      if (/session|unauthorized|expired/i.test(error.message || '')) return logout();
      toast(error.message);
    } finally {
      $('#refresh').disabled = false;
      $('#refresh').textContent = 'Refresh Applications';
    }
  }

  function renderPipeline(status) {
    const current = PIPELINE.indexOf(status);
    $('#pipeline').innerHTML = PIPELINE.map((stage,index) => {
      const cls = stage === status ? 'active' : current >= 0 && index < current ? 'done' : '';
      return `<div class="pipeline-step ${cls}">${stage}</div>`;
    }).join('');
  }

  function fillForm(record) {
    ['status','advisor','messageTitle','messageBody','approvedAmount','quote','notes'].forEach(key => {
      const el = $(`#${key}`);
      if (el) el.value = record[key] || '';
    });
    updatePreview();
  }

  function renderDetails(record) {
    $('#details').innerHTML = [
      ['Client',record.name],['Email',record.email],['Phone',record.phone],['Business',record.business],
      ['Requested Amount',money(record.requested)],['Monthly Revenue',money(record.revenue)],
      ['Next Action',record.nextAction||'—'],['Created',date(record.created)],['Updated',date(record.updated)]
    ].map(([key,value]) => `<div class="kv"><b>${key}</b><span>${value||'—'}</span></div>`).join('');
  }

  async function openFile(id) {
    selected = applications.find(a => String(a.applicationId) === String(id));
    if (!selected) return;

    $('#drawer').classList.add('show');
    $('#backdrop').classList.add('show');
    $('#dTitle').textContent = `${selected.applicationId} · ${selected.business||selected.name||'Client'}`;
    $('#summaryStatus').textContent = selected.status || 'Account Created';
    $('#summaryStatements').textContent = `${selected.statements||0} / ${minStatements}`;
    $('#summaryAdvisor').textContent = selected.advisor || 'Unassigned';
    $('#summaryRevision').textContent = `#${selected.revision||1}`;
    renderDetails(selected);
    renderPipeline(selected.status);
    fillForm(selected);
    updateDriveButton();
    $('#saveMsg').textContent = '';
    $('#documents').innerHTML = '<li><span class="subtle">Loading documents…</span></li>';
    $('#activity').innerHTML = '<li><span class="subtle">Loading activity…</span></li>';

    await Promise.allSettled([loadDocuments(),loadActivity()]);
  }

  function closeDrawer() {
    $('#drawer').classList.remove('show');
    $('#backdrop').classList.remove('show');
    selected = null;
  }

  async function loadDocuments() {
    if (!selected) return;
    try {
      const result = await CRM.get('getDocuments',{applicationId:selected.applicationId});
      const docs = result.data || [];
      $('#documentCount').textContent = `${docs.length} file${docs.length===1?'':'s'}`;
      $('#documents').innerHTML = docs.length ? docs.map(d => `<li><div><a href="${d.url}" target="_blank" rel="noopener"><strong>${d.name||'Document'}</strong></a><div class="subtle">${d.type||'document'}</div></div><span class="subtle">${date(d.created)}</span></li>`).join('') : '<li><span class="subtle">No documents uploaded yet.</span></li>';
    } catch (error) {
      $('#documents').innerHTML = `<li><span class="subtle">${error.message}</span></li>`;
    }
  }

  async function loadActivity() {
    if (!selected) return;
    try {
      const result = await CRM.get('getActivity',{applicationId:selected.applicationId,limit:20});
      const items = result.data || [];
      $('#activity').innerHTML = items.length ? items.map(item => `<li class="activity-item"><time>${date(item.created)}</time><div><strong>${item.action||'Update'}</strong><p>${item.detail||''}</p></div></li>`).join('') : '<li><span class="subtle">No activity recorded yet.</span></li>';
    } catch (error) {
      $('#activity').innerHTML = `<li><span class="subtle">${error.message}</span></li>`;
    }
  }

  function updatePreview() {
    $('#previewTitle').textContent = $('#messageTitle').value || 'Welcome';
    $('#previewBody').textContent = $('#messageBody').value || 'Your advisor message will appear here.';
  }

  function chooseStage(status) {
    $('#status').value = status;
    const preset = PRESETS[status];
    if (preset) {
      $('#messageTitle').value = preset[0];
      $('#messageBody').value = preset[1];
      updatePreview();
    }
    toast(`Stage set to ${status}`);
  }

  async function save() {
    if (!selected) return;
    const payload = { applicationId:selected.applicationId, revision:selected.revision||0 };
    ['status','advisor','messageTitle','messageBody','approvedAmount','quote','notes'].forEach(key => payload[key] = $(`#${key}`).value);

    $('#save').disabled = true;
    $('#save').textContent = 'Saving...';
    $('#saveMsg').className = 'notice';
    $('#saveMsg').textContent = 'Saving update…';

    try {
      const result = await CRM.post('adminUpdate',payload,{timeout:12000});
      selected = result.data;
      const index = applications.findIndex(a => String(a.applicationId) === String(selected.applicationId));
      if (index >= 0) applications[index] = selected;
      render();
      renderDetails(selected);
      renderPipeline(selected.status);
      fillForm(selected);
      updateDriveButton();
      $('#summaryStatus').textContent = selected.status;
      $('#summaryAdvisor').textContent = selected.advisor || 'Unassigned';
      $('#summaryRevision').textContent = `#${selected.revision||1}`;
      $('#saveMsg').className = 'notice success';
      $('#saveMsg').textContent = result.notificationQueued
        ? 'Saved instantly. Client dashboard updated and approval email queued.'
        : 'Saved. Client dashboard is updated.';
      toast('Client update saved');
      loadActivity();
    } catch (error) {
      $('#saveMsg').className = 'notice error';
      $('#saveMsg').textContent = error.message;
      if (/changed by another|revision/i.test(error.message || '')) await load();
    } finally {
      $('#save').disabled = false;
      $('#save').textContent = 'Save Client Update';
    }
  }

  function updateDriveButton() {
    if (!selected) return;
    $('#drive').textContent = selected.driveUrl ? 'Open Drive Folder' : 'Create & Open Drive Folder';
  }

  async function drive() {
    if (!selected) return;
    if (selected.driveUrl) return window.open(selected.driveUrl,'_blank','noopener');
    $('#drive').disabled = true;
    $('#drive').textContent = 'Creating Folder...';
    try {
      const result = await CRM.post('adminEnsureDrive',{applicationId:selected.applicationId},{timeout:18000});
      Object.assign(selected,result.data);
      updateDriveButton();
      window.open(selected.driveUrl,'_blank','noopener');
      toast('Drive folder ready');
      loadActivity();
    } catch (error) {
      toast(error.message);
    } finally {
      $('#drive').disabled = false;
      updateDriveButton();
    }
  }

  async function login() {
    const email = $('#adminEmail').value.trim().toLowerCase();
    const password = $('#adminPassword').value;
    $('#adminLogin').disabled = true;
    $('#loginMsg').className = 'notice';
    $('#loginMsg').textContent = 'Signing in…';
    try {
      await CRM.adminLogin(email,password);
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

  function logout() {
    CRM.logout();
    location.replace('admin.html');
  }

  function init() {
    $('#filter').innerHTML = '<option value="">All statuses</option>' + STAGES.map(s => `<option>${s}</option>`).join('');
    $('#status').innerHTML = STAGES.map(s => `<option>${s}</option>`).join('');
    $('#adminLogin').onclick = login;
    $('#adminPassword').addEventListener('keydown',e => { if (e.key === 'Enter') login(); });
    $('#refresh').onclick = () => load(true);
    $('#save').onclick = save;
    $('#drive').onclick = drive;
    $('#close').onclick = closeDrawer;
    $('#backdrop').onclick = closeDrawer;
    $('#logoutBtn').onclick = logout;
    $('#websiteLink').onclick = () => location.href='index.html';
    $('#portalLink').onclick = () => location.href='client-dashboard.html?login=1';
    $('#search').oninput = render;
    $('#filter').onchange = render;
    $('#messageTitle').oninput = updatePreview;
    $('#messageBody').oninput = updatePreview;
    $('#copyId').onclick = () => selected?.applicationId && navigator.clipboard?.writeText(selected.applicationId).then(() => toast('Application ID copied'));
    $('#clearFilters').onclick = () => { $('#search').value='';$('#filter').value='';activeChip='';document.querySelectorAll('.chip').forEach((c,i)=>c.classList.toggle('active',i===0));render(); };
    document.querySelectorAll('.chip').forEach(c => c.onclick = () => { activeChip=c.dataset.chip;document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');render(); });
    document.querySelectorAll('[data-status]').forEach(btn => btn.onclick = () => chooseStage(btn.dataset.status));

    const session = CRM.getSession();
    if (session?.role === 'admin') {
      $('#login').classList.add('hidden');
      $('#admin').classList.remove('hidden');
      $('#logoutBtn').classList.remove('hidden');
      load();
    }
  }

  document.addEventListener('DOMContentLoaded',init,{once:true});
})();