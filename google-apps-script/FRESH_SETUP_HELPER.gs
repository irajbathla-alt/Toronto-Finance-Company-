// Toronto Finance Company — one-time helper for a BRAND-NEW Apps Script project.
// 1) Change the password below to your private admin password (8+ characters).
// 2) Run SETUP_FRESH_CRM from the Apps Script function dropdown.
// 3) After it succeeds, replace the password below with CHANGE_AFTER_SETUP before deploying.

function SETUP_FRESH_CRM() {
  const privateAdminPassword = 'PUT_YOUR_8_PLUS_CHARACTER_PASSWORD_HERE';

  if (!privateAdminPassword ||
      privateAdminPassword === 'PUT_YOUR_8_PLUS_CHARACTER_PASSWORD_HERE' ||
      privateAdminPassword.length < 8) {
    throw new Error('Edit privateAdminPassword inside SETUP_FRESH_CRM and use at least 8 characters, then run SETUP_FRESH_CRM again.');
  }

  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', privateAdminPassword);
  const schema = repairApplicationsSchema();
  const health = healthCheck();

  if (!health.ok) {
    throw new Error('CRM setup completed but health check failed: ' + JSON.stringify(health));
  }

  return {
    ok: true,
    message: 'Fresh CRM setup complete. Replace the password in FRESH_SETUP_HELPER.gs with CHANGE_AFTER_SETUP before deploying.',
    schema,
    health
  };
}
