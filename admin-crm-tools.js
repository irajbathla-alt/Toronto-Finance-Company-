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

  const STAGE_PRESETS = {
    'Statements Required': {
      title: 'Bank Statements Required',
      body: 'Please upload your six most recent monthly business bank statements so we can continue reviewing your financing application.'
    },
    'Ready for Review': {
      title: 'Documents Received',
      body: 'Thank you. Your required documents have been received and your financing application is ready for review.'
    },
    'Under Review': {
      title: 'Application Under Review',
      body: 'Your financing application is currently under review. We will update your dashboard if any additional information is required.'
    },
    'Additional Documents Required': {
      title: 'Additional Documents Required',
      body: 'Additional information is required to continue reviewing your application. Please review your advisor’s instructions and provide the requested documents.'
    },
    'Conditional Approval': {
      title: 'Conditional Approval Available',
      body: 'A conditional financing approval is available. Please review the advisor message and contact your advisor to discuss the conditions and next steps.'
    },
    'Approved': {
      title: 'Financing Approval Available',
      body: 'Your financing application has been approved. Please review the advisor message and contact your advisor to discuss the approved amount, terms and next steps.'
    },
    'Funded': {
      title: 'Financing Completed',
      body: 'Your financing file has been completed. Please contact your advisor if you require any additional assistance.'
    },
    'Declined': {
      title: 'Application Update',
      body: 'There is an important update regarding your financing application. Please review your dashboard and contact your advisor to discuss available next steps.'
    }
  };

  const normalize = value => String(value ?? '').trim();
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  function exactMatch(data, update) {
    return VERIFY_FIELDS.every(field => normalize(data?.[field]) === normalize(update[field]));
  }

  function longJsonp(action, payload = {}, timeout = 25000) {
    return new Promise((resolve, reject) => {
      const callbackName = `tfc_admin_tools_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({
        action,
        callback: callbackName,
        _: String(Date.now())
      });

      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('The CRM action took too long. Please confirm the latest Apps Script version is deployed.'));
      }, timeout);

      function cleanup() {
        clearTimeout(timer);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = result => {
        cleanup();
        resolve(result);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('Could not reach the CRM service.'));
      };

      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  function applyStagePreset(status) {
    const preset = STAGE_PRESETS[status];
    document.querySelector('#status').value = status;
    if (preset) {
      document.querySelector('#messageTitle').value = preset.title;
      document.querySelector('#messageBody').value = preset.body;
      updatePreview();
    }
    toast(`Stage set to ${status}`);
  }

  function updateDriveButton() {
    const button = document.querySelector('#drive');
    if (!button || !selected) return;
    button.textContent = selected.driveUrl ? 'Open Drive Folder' : 'Create & Open Drive Folder';
  }

  async function openOrCreateDrive() {
    if (!selected?.applicationId) return;
    const button = document.querySelector('#drive');

    if (selected.driveUrl) {
      window.open(selected.driveUrl, '_blank', 'noopener');
      return;
    }

    button.disabled = true;
    button.textContent = 'Creating Drive Folder...';
    const saveMessage = document.querySelector('#saveMsg');
    saveMessage.className = 'notice';
    saveMessage.textContent = 'Creating the client folder and document subfolders in Google Drive...';

    try {
      const result = await longJsonp('adminEnsureDrive', {
        applicationId: selected.applicationId
      });
      if (!result?.ok || !result?.data?.driveUrl) {
        throw new Error(result?.error || 'The Drive folder could not be created.');
      }

      Object.assign(selected, result.data);
      const index = applications.findIndex(item => String(item.applicationId) === String(selected.applicationId));
      if (index >= 0) applications[index] = selected;
      render();
      openFile(selected.applicationId);
      saveMessage.className = 'notice success';
      saveMessage.textContent = 'Drive folder created successfully.';
      toast('Drive folder ready');
      window.open(result.data.driveUrl, '_blank', 'noopener');
    } catch (error) {
      saveMessage.className = 'notice error';
      saveMessage.textContent = error.message;
      updateDriveButton();
    } finally {
      button.disabled = false;
      updateDriveButton();
    }
  }

  async function confirmSavedUpdate(update) {
    for (const delayMs of [500, 700, 900, 1200, 1600, 2200, 3000, 4000, 5000]) {
      await wait(delayMs);
      try {
        const result = await readApi('getClient', { applicationId: update.applicationId });
        if (result?.ok && exactMatch(result.data, update)) return result.data;
      } catch (_) {}
    }
    return null;
  }

  async function verifiedSave() {
    if (!selected?.applicationId) return;

    const update = { applicationId: selected.applicationId };
    VERIFY_FIELDS.forEach(field => {
      update[field] = document.querySelector(`#${field}`).value;
    });

    const saveButton = document.querySelector('#save');
    const saveMessage = document.querySelector('#saveMsg');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    saveMessage.className = 'notice';
    saveMessage.textContent = 'Sending the stage and client message to Google Sheets...';

    try {
      // Apps Script may keep the POST response open while processing an approval email.
      // Start the write, but judge success only by reading the exact saved values back.
      sendUpdate(update).catch(() => null);
      saveMessage.textContent = 'Update sent. Confirming the exact stage and client message...';

      const confirmedData = await confirmSavedUpdate(update);
      if (!confirmedData) {
        throw new Error('The CRM did not confirm the exact saved values. Refresh Applications before trying the update again.');
      }

      Object.assign(selected, confirmedData);
      const index = applications.findIndex(item => String(item.applicationId) === String(update.applicationId));
      if (index >= 0) applications[index] = selected;
      render();
      openFile(update.applicationId);
      saveMessage.className = 'notice success';
      saveMessage.textContent = 'Saved and verified. The client dashboard now shows this stage and advisor message.';
      toast('Client update verified');
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
    const driveButton = document.querySelector('#drive');
    if (
      !saveButton ||
      !driveButton ||
      typeof readApi !== 'function' ||
      typeof sendUpdate !== 'function' ||
      typeof openFile !== 'function' ||
      typeof render !== 'function'
    ) {
      setTimeout(install, 100);
      return;
    }

    if (saveButton.dataset.crmToolsReady === 'true') return;
    saveButton.dataset.crmToolsReady = 'true';

    saveButton.onclick = verifiedSave;
    driveButton.onclick = openOrCreateDrive;

    document.querySelectorAll('[data-status]').forEach(button => {
      button.onclick = () => {
        if (selected) applyStagePreset(button.dataset.status);
      };
    });

    const originalOpenFile = openFile;
    openFile = function patchedOpenFile(id) {
      originalOpenFile(id);
      setTimeout(updateDriveButton, 0);
    };

    updateDriveButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
