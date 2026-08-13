(() => {
  'use strict';

  const cfg = window.TFC_CONFIG || {};
  let currentClient = null;

  function api(action, payload = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('CRM service is not configured.'));
      const callback = `tfc_decision_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({ action, callback, _: String(Date.now()) });
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('The CRM is taking longer than expected. Please try again.'));
      }, timeout);
      function cleanup() {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[callback] = data => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error('The CRM could not be reached.')); };
      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  function money(value) {
    const n = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n) && n) return `CA$${n.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    return value || '—';
  }

  function ensureStyles() {
    if (document.getElementById('tfcDecisionStyles')) return;
    const style = document.createElement('style');
    style.id = 'tfcDecisionStyles';
    style.textContent = `
      .decision-wrap{display:none;margin-top:18px;background:#fff;border:1px solid rgba(23,19,15,.08);border-radius:14px;padding:26px}.decision-wrap.show{display:block}
      .decision-kicker{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:7px}.decision-wrap h2,.decision-wrap h3{font-family:'Cormorant Garamond',serif;font-weight:400;text-transform:uppercase}.decision-wrap h2{font-size:31px;margin:0 0 8px}.decision-wrap h3{font-size:24px;margin:0}.decision-wrap p{font-size:13px;line-height:1.7;color:var(--muted)}
      .decision-disclaimer{margin:17px 0 20px;padding:14px 16px;border-left:4px solid var(--red);background:#fff8f6;border-radius:8px;font-size:11px;line-height:1.6;color:#685750}.decision-disclaimer strong{display:block;color:var(--red);text-transform:uppercase;letter-spacing:.1em;font-size:9px;margin-bottom:4px}
      .decision-card{border:1px solid rgba(198,150,78,.35);border-radius:12px;padding:22px}.decision-card-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.decision-amount{font-family:'Cormorant Garamond',serif;font-size:31px;color:#9f7434;white-space:nowrap}
      .decision-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin-top:18px}.decision-grid div{background:var(--soft);padding:13px}.decision-grid small{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin-bottom:4px}.decision-grid strong{font-size:12px;font-weight:500}
      .decision-note{width:100%;min-height:86px;margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:9px;background:var(--soft);font:inherit;font-size:12px;resize:vertical}.decision-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.decision-actions button{border-radius:999px;padding:13px 16px;text-transform:uppercase;letter-spacing:.09em;font-size:9px;cursor:pointer}.decision-proceed{border:0;background:var(--ink);color:#fff}.decision-info{background:var(--soft);border:1px solid var(--line);color:var(--ink)}
      .decision-status{display:none;margin-top:16px;padding:13px 15px;border-radius:9px;background:#edf6f0;color:var(--green);font-size:12px;line-height:1.6}.decision-status.show{display:block}
      .requested-docs{display:none;margin-top:22px;padding-top:20px;border-top:1px solid var(--line)}.requested-docs.show{display:block}.requested-box{padding:14px 16px;background:var(--soft);border-left:3px solid var(--gold);font-size:12px;line-height:1.65;white-space:pre-wrap}.requested-row{display:grid;grid-template-columns:180px 1fr;gap:10px;margin-top:14px}.requested-row select,.requested-row input{width:100%;padding:11px;border:1px solid var(--line);border-radius:8px;background:#fff;font:inherit;font-size:12px}.requested-upload{width:100%;margin-top:12px;border:0;border-radius:999px;padding:13px;background:var(--ink);color:#fff;text-transform:uppercase;letter-spacing:.1em;font-size:9px;cursor:pointer}.requested-msg{font-size:11px;margin-top:9px;color:var(--muted)}
      @media(max-width:760px){.decision-grid{grid-template-columns:1fr}.decision-actions{grid-template-columns:1fr}.decision-card-head{display:block}.decision-amount{margin-top:7px}.requested-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureUI() {
    ensureStyles();
    let box = document.getElementById('financingDecision');
    if (box) return box;
    const future = document.querySelector('.future');
    if (!future) return null;
    box = document.createElement('section');
    box.id = 'financingDecision';
    box.className = 'decision-wrap';
    box.innerHTML = `
      <div id="decisionOfferArea">
        <div class="decision-kicker">Financing Available</div>
        <h2>Review your financing details.</h2>
        <p>Please review the details below. You can ask us to continue with this financing or request more information before deciding.</p>
        <div class="decision-disclaimer"><strong>Indicative only — not a commitment to lend</strong>Any financing shown here remains subject to final lender review, underwriting, documentation, eligibility, conditions and execution of final agreements. Selecting Proceed only asks Toronto Finance Company to continue the process and does not create a binding lending commitment.</div>
        <div class="decision-card" id="decisionCard"></div>
        <textarea class="decision-note" id="decisionNote" placeholder="Optional: add a question or note for your advisor"></textarea>
        <div class="decision-actions"><button class="decision-proceed" id="decisionProceed">Proceed</button><button class="decision-info" id="decisionMoreInfo">Request More Information</button></div>
        <div class="decision-status" id="decisionStatus"></div>
      </div>
      <div class="requested-docs" id="requestedDocs"><div class="decision-kicker">Additional Documents Requested</div><h3>Upload requested documents</h3><div class="requested-box" id="requestedText"></div><div class="requested-row"><select id="requestedCategory"><option value="identification">Identification</option><option value="financial">Financial Statements</option><option value="other">Other Documents</option></select><input id="requestedFiles" type="file" multiple></div><button class="requested-upload" id="requestedUpload">Upload Selected Documents</button><div class="requested-msg" id="requestedMsg"></div></div>
    `;
    future.parentNode.insertBefore(box, future);
    return box;
  }

  function render(data) {
    currentClient = data || currentClient;
    const box = ensureUI();
    if (!box || !currentClient) return;

    const status = String(currentClient.status || '');
    const hasOffer = Boolean(currentClient.approvedAmount || currentClient.quote || currentClient.term || currentClient.paymentAmount || currentClient.totalRepayment);
    const canDecide = ['Conditional Approval', 'Approved'].includes(status) && hasOffer;
    const requested = String(currentClient.documentsRequested || '').trim();
    box.classList.toggle('show', Boolean(canDecide || requested));
    if (!canDecide && !requested) return;

    const offerArea = document.getElementById('decisionOfferArea');
    offerArea.style.display = canDecide ? 'block' : 'none';

    if (canDecide) {
      document.getElementById('decisionCard').innerHTML = `
        <div class="decision-card-head"><h3>${currentClient.quote || 'Financing Available'}</h3><div class="decision-amount">${money(currentClient.approvedAmount)}</div></div>
        <div class="decision-grid">
          <div><small>Term</small><strong>${currentClient.term || '—'}</strong></div>
          <div><small>Payment Frequency</small><strong>${currentClient.paymentFrequency || '—'}</strong></div>
          <div><small>Payment Amount</small><strong>${money(currentClient.paymentAmount)}</strong></div>
          <div><small>Number of Payments</small><strong>${currentClient.numberPayments || '—'}</strong></div>
          <div><small>Total Repayment</small><strong>${money(currentClient.totalRepayment)}</strong></div>
          <div><small>Status</small><strong>${status}</strong></div>
        </div>`;

      const note = document.getElementById('decisionNote');
      note.value = currentClient.clientDecisionNote || '';
      const response = document.getElementById('decisionStatus');
      if (currentClient.clientDecision) {
        response.classList.add('show');
        response.textContent = `Your response has been sent: ${currentClient.clientDecision}. Your advisor has been notified.`;
      } else {
        response.classList.remove('show');
        response.textContent = '';
      }
      document.getElementById('decisionProceed').onclick = () => submitDecision('Proceed');
      document.getElementById('decisionMoreInfo').onclick = () => submitDecision('Request More Information');
    }

    const requestedBox = document.getElementById('requestedDocs');
    requestedBox.classList.toggle('show', Boolean(requested));
    document.getElementById('requestedText').textContent = requested;
    document.getElementById('requestedUpload').onclick = uploadRequestedDocuments;
  }

  async function submitDecision(decision) {
    if (!currentClient?.applicationId) return;
    const response = document.getElementById('decisionStatus');
    const proceed = document.getElementById('decisionProceed');
    const info = document.getElementById('decisionMoreInfo');
    proceed.disabled = info.disabled = true;
    response.classList.add('show');
    response.textContent = 'Sending your response…';
    try {
      const result = await api('clientDecision', {
        applicationId: currentClient.applicationId,
        email: currentClient.email || '',
        decision,
        note: document.getElementById('decisionNote').value.trim()
      });
      if (!result?.ok) throw new Error(result?.error || 'Your response could not be sent.');
      currentClient = { ...currentClient, ...(result.data || {}) };
      try { localStorage.setItem('tfc-current-application', JSON.stringify(currentClient)); } catch (_) {}
      render(currentClient);
    } catch (error) {
      response.textContent = error.message || 'Your response could not be sent. Please try again.';
    } finally {
      proceed.disabled = info.disabled = false;
    }
  }

  async function uploadRequestedDocuments() {
    if (!currentClient?.applicationId) return;
    const input = document.getElementById('requestedFiles');
    const category = document.getElementById('requestedCategory').value;
    const message = document.getElementById('requestedMsg');
    const button = document.getElementById('requestedUpload');
    const files = [...input.files];
    if (!files.length) {
      message.textContent = 'Select one or more requested documents first.';
      return;
    }
    button.disabled = true;
    message.textContent = `Uploading ${files.length} document(s)…`;
    try {
      for (const file of files) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
          reader.readAsDataURL(file);
        });
        await fetch(cfg.apiUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({ action:'uploadDocument', applicationId:currentClient.applicationId, fileName:file.name, mimeType:file.type || 'application/octet-stream', base64, type:category })
        });
      }
      input.value = '';
      message.textContent = 'Documents sent. Your advisor will see them in your file.';
    } catch (error) {
      message.textContent = error.message || 'Upload failed. Please try again.';
    } finally {
      button.disabled = false;
    }
  }

  function install() {
    ensureUI();
    const existing = window.showDashboard;
    if (typeof existing === 'function' && !existing.__decisionWrapped) {
      const wrapped = function(data) {
        const result = existing(data);
        setTimeout(() => render(data), 0);
        return result;
      };
      wrapped.__decisionWrapped = true;
      window.showDashboard = wrapped;
    }
    try {
      const cached = JSON.parse(localStorage.getItem('tfc-current-application') || 'null');
      if (cached?.applicationId) render(cached);
    } catch (_) {}
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    install();
    if (typeof window.showDashboard === 'function' || attempts > 50) clearInterval(timer);
  }, 100);
})();