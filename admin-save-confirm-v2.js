(() => {
  const VERIFY_FIELDS = [
    'status',
    'advisor',
    'messageTitle',
    'messageBody',
    'approvedAmount',
    'quote',
    'notes'
  ];

  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const normalize = value => String(value ?? '').trim();

  function exactMatch(data, update) {
    return VERIFY_FIELDS.every(field => normalize(data?.[field]) === normalize(update[field]));
  }

  async function confirmSavedUpdate(update) {
    for (const delayMs of [400, 600, 800, 1100, 1500, 2100, 3000, 4000, 5000]) {
      await wait(delayMs);
      try {
        const result = await readApi('getClient', { applicationId: update.applicationId });
        if (result?.ok && exactMatch(result.data, update)) return result.data;
      } catch (_) {}
    }
    return null;
  }

  async function verifiedSaveV2() {
    if (!selected?.applicationId) return;

    const update = { applicationId: selected.applicationId };
    VERIFY_FIELDS.forEach(field => {
      update[field] = document.querySelector(`#${field}`)?.value ?? '';
    });

    const saveButton = document.querySelector('#save');
    const saveMessage = document.querySelector('#saveMsg');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    saveMessage.className = 'notice';
    saveMessage.textContent = 'Sending the update and confirming Google Sheets...';

    try {
      // Apps Script can keep the POST response open while email notification work continues.
      // Do not use that slow response as the success signal.
      sendUpdate(update).catch(() => null);

      const confirmedData = await confirmSavedUpdate(update);
      if (!confirmedData) {
        throw new Error('The update could not be confirmed. Click Refresh Applications before trying again.');
      }

      Object.assign(selected, confirmedData);
      const index = applications.findIndex(item => String(item.applicationId) === String(update.applicationId));
      if (index >= 0) applications[index] = selected;
      render();
      openFile(update.applicationId);

      saveMessage.className = 'notice success';
      saveMessage.textContent = 'Saved and verified. The client portal now shows this stage and message.';
      if (typeof toast === 'function') toast('Client update verified');
    } catch (error) {
      saveMessage.className = 'notice error';
      saveMessage.textContent = error.message || 'The update could not be verified.';
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save Client Update';
    }
  }

  function install() {
    const saveButton = document.querySelector('#save');
    if (
      !saveButton ||
      typeof sendUpdate !== 'function' ||
      typeof readApi !== 'function' ||
      typeof render !== 'function' ||
      typeof openFile !== 'function'
    ) {
      setTimeout(install, 100);
      return;
    }

    saveButton.onclick = verifiedSaveV2;
    saveButton.dataset.saveConfirmationVersion = '2';
  }

  if (document.readyState === 'complete') install();
  else window.addEventListener('load', install, { once: true });
})();
