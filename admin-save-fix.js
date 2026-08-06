(() => {
  const SAVE_FIELDS = [
    'status',
    'advisor',
    'messageTitle',
    'messageBody',
    'approvedAmount',
    'quote',
    'notes'
  ];

  let saving = false;

  function getElement(id) {
    return document.getElementById(id);
  }

  function setSaveState(isSaving, message, kind = '') {
    const button = getElement('save');
    const notice = getElement('saveMsg');

    if (button) {
      button.disabled = isSaving;
      button.textContent = isSaving ? 'Saving...' : 'Save Client Update';
    }

    if (notice) {
      notice.className = 'notice' + (kind ? ' ' + kind : '');
      notice.textContent = message || '';
    }
  }

  function collectUpdate() {
    if (typeof selected === 'undefined' || !selected?.applicationId) return null;

    const update = { applicationId: selected.applicationId };
    SAVE_FIELDS.forEach(key => {
      update[key] = getElement(key)?.value ?? '';
    });
    return update;
  }

  async function sendUpdate(update) {
    if (!window.TFC_CONFIG?.apiUrl) {
      throw new Error('The CRM service is not configured.');
    }

    await fetch(window.TFC_CONFIG.apiUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ action: 'adminUpdate', ...update })
    });
  }

  function updateLocalView(update) {
    if (typeof applications === 'undefined' || typeof selected === 'undefined') return;

    const updatedRecord = {
      ...selected,
      ...update,
      updated: new Date().toISOString()
    };

    const index = applications.findIndex(
      item => String(item.applicationId) === String(update.applicationId)
    );

    if (index >= 0) applications[index] = updatedRecord;
    selected = updatedRecord;

    if (typeof render === 'function') render();

    const previewTitle = getElement('previewTitle');
    const previewBody = getElement('previewBody');
    const summaryStatus = getElement('summaryStatus');
    const summaryAdvisor = getElement('summaryAdvisor');

    if (previewTitle) previewTitle.textContent = update.messageTitle || 'Welcome';
    if (previewBody) previewBody.textContent = update.messageBody || 'Your Toronto Finance Company account has been created.';
    if (summaryStatus) summaryStatus.textContent = update.status || 'Account Created';
    if (summaryAdvisor) summaryAdvisor.textContent = update.advisor || 'Unassigned';
  }

  async function handleSave(event) {
    const target = event.target?.closest?.('#save');
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (saving) return;

    const update = collectUpdate();
    if (!update) {
      setSaveState(false, 'Open an application before saving.', 'error');
      return;
    }

    saving = true;
    setSaveState(true, 'Saving update to Google Sheets...');

    try {
      await sendUpdate(update);
      updateLocalView(update);
      setSaveState(false, 'Update sent successfully. Use Refresh Applications to confirm the latest Google Sheets values.', 'success');
      if (typeof toast === 'function') toast('Client update sent');
    } catch (error) {
      setSaveState(false, error.message || 'The update could not be sent.', 'error');
    } finally {
      saving = false;
    }
  }

  function install() {
    document.addEventListener('click', handleSave, true);

    const button = getElement('save');
    if (button) button.dataset.postSaveEnabled = 'true';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
