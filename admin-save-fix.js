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

  const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  function valuesMatch(record, update) {
    return SAVE_FIELDS.every(key => String(record?.[key] ?? '') === String(update[key] ?? ''));
  }

  async function saveUpdateWithPost() {
    if (!selected) return;

    const applicationId = selected.applicationId;
    const update = { applicationId };
    SAVE_FIELDS.forEach(key => {
      update[key] = document.getElementById(key)?.value ?? '';
    });

    const saveButton = document.getElementById('save');
    const saveMessage = document.getElementById('saveMsg');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    saveMessage.className = 'notice';
    saveMessage.textContent = 'Saving update to Google Sheets...';

    try {
      await fetch(cfg.apiUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: 'adminUpdate', ...update })
      });

      let confirmedRecord = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await delay(attempt === 0 ? 650 : 1100);
        try {
          const result = await api('getClient', { applicationId });
          if (result?.ok && valuesMatch(result.data, update)) {
            confirmedRecord = result.data;
            break;
          }
        } catch (_) {
          // The POST may already have succeeded. Continue checking before showing an error.
        }
      }

      if (!confirmedRecord) {
        throw new Error('The update was sent, but Google Sheets did not confirm it yet. Refresh applications and check the file again.');
      }

      const index = applications.findIndex(item => String(item.applicationId) === String(applicationId));
      if (index >= 0) applications[index] = { ...applications[index], ...confirmedRecord };
      selected = index >= 0 ? applications[index] : confirmedRecord;

      render();
      openFile(applicationId);
      saveMessage.className = 'notice success';
      saveMessage.textContent = 'Saved and confirmed in Google Sheets. The client dashboard will show the updated message and status.';
      toast('Client update saved');
    } catch (error) {
      saveMessage.className = 'notice error';
      saveMessage.textContent = error.message || 'The update could not be saved.';
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save Client Update';
    }
  }

  function install() {
    const saveButton = document.getElementById('save');
    if (!saveButton || typeof api !== 'function') {
      setTimeout(install, 100);
      return;
    }

    saveButton.onclick = saveUpdateWithPost;
    saveButton.dataset.postSaveEnabled = 'true';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
