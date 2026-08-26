const CONFIG = {
  SHEET_ID: '1pRN82iNCVpU31DJQA3xUrMVkMcPRPv1Rl69WH3VRco4',
  ROOT_FOLDER_ID: '1ao4Tlk65yxtr8yHGJaNGqyKPOHYFfXjb',
  ADMIN_EMAIL: 'admin@torontofinance.ca',
  SIGNUP_NOTIFICATION_EMAIL: 'info@torontofinancecompany.com',
  ADMIN_PASSWORD: 'CHANGE_THIS_PASSWORD',
  CLIENT_PORTAL_URL: 'https://irajbathla-alt.github.io/Toronto-Finance-Company-/client-dashboard.html',
  CLIENT_NOTIFICATION_FROM: 'info@torontofinancecompany.com',
  COMPANY_NAME: 'Toronto Finance Company',
  MIN_STATEMENTS: 6
};

const REQUIRED_HEADERS = [
  'applicationId','created','updated','name','email','passwordHash','phone','business',
  'address','city','province','postal','industry','revenue','requested','years','purpose',
  'status','statements','advisor','messageTitle','messageBody','approvedAmount','quote',
  'term','paymentFrequency','paymentAmount','numberPayments','totalRepayment','documentsRequested',
  'clientDecision','clientDecisionNote','clientDecisionAt','notes',
  'driveFolderId','driveUrl','lastNotificationStatus','lastNotificationAt','lastNotificationError'
];

const APPROVAL_STATUSES = ['Conditional Approval','Approved'];
const SCHEMA_CACHE_KEY = 'tfc-schema-20260818-v1';

function doGet(e) {
  try {
    const p = parseGet(e);
    if (!p.action || p.action === 'health') return output(health(), p.callback);

    const actions = {
      createAccount,
      clientLogin,
      getClient,
      clientDecision,
      adminLogin,
      adminList,
      adminUpdate,
      adminEnsureDrive,
      getDocuments
    };

    if (!actions[p.action]) throw new Error('Unknown action');
    return output(actions[p.action](p), p.callback);
  } catch (err) {
    return output({ ok:false, error:err.message || String(err) }, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  try {
    const p = parsePost(e);
    const actions = {
      createAccount,
      clientLogin,
      getClient,
      clientDecision,
      uploadDocument,
      adminLogin,
      adminList,
      adminUpdate,
      adminEnsureDrive,
      getDocuments
    };

    if (!actions[p.action]) throw new Error('Unknown action');
    return json(actions[p.action](p));
  } catch (err) {
    return json({ ok:false, error:err.message || String(err) });
  }
}

function parseGet(e) {
  const q = (e && e.parameter) || {};
  if (q.payload) {
    try { return { ...JSON.parse(q.payload), callback:q.callback }; } catch (_) {}
  }
  return { ...q };
}

function parsePost(e) {
  const raw = (e && e.postData && e.postData.contents) || '';
  if (raw) {
    try { return JSON.parse(raw); } catch (_) {}
  }
  return { ...((e && e.parameter) || {}) };
}

function output(value, callback) {
  if (callback) {
    const cb = String(callback).replace(/[^a-zA-Z0-9_.$]/g,'');
    return ContentService
      .createTextOutput(`${cb}(${JSON.stringify(value)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json(value);
}

function json(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function health() {
  return {
    ok:true,
    service:'Toronto Finance Company CRM Simple 1.3',
    minimumStatements:CONFIG.MIN_STATEMENTS,
    adminPasswordConfigured:CONFIG.ADMIN_PASSWORD !== 'CHANGE_THIS_PASSWORD',
    clientNotificationFrom:CONFIG.CLIENT_NOTIFICATION_FROM
  };
}

function applicationsSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sh = ss.getSheetByName('Applications');
  const cache = CacheService.getScriptCache();

  if (!sh) {
    sh = ss.insertSheet('Applications');
    ensureColumnCapacity(sh, REQUIRED_HEADERS.length);
    sh.getRange(1,1,1,REQUIRED_HEADERS.length).setValues([REQUIRED_HEADERS]);
    cache.put(SCHEMA_CACHE_KEY,'1',21600);
    return sh;
  }

  if (cache.get(SCHEMA_CACHE_KEY) !== '1') {
    ensureSchema(sh);
    cache.put(SCHEMA_CACHE_KEY,'1',21600);
  }

  return sh;
}

function ensureColumnCapacity(sh, requiredColumns) {
  const current = sh.getMaxColumns();
  if (current < requiredColumns) {
    sh.insertColumnsAfter(current, requiredColumns - current);
  }
}

function ensureSchema(sh) {
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    ensureColumnCapacity(sh, REQUIRED_HEADERS.length);
    sh.getRange(1,1,1,REQUIRED_HEADERS.length).setValues([REQUIRED_HEADERS]);
    return REQUIRED_HEADERS.slice();
  }

  const width = Math.max(1, sh.getLastColumn());
  const headers = sh.getRange(1,1,1,width).getValues()[0]
    .map(value => String(value || '').trim());

  const merged = headers.slice();
  REQUIRED_HEADERS.forEach(header => {
    if (!merged.includes(header)) merged.push(header);
  });

  ensureColumnCapacity(sh, merged.length);
  if (merged.length !== width) {
    sh.getRange(1,1,1,merged.length).setValues([merged]);
  }

  return merged;
}

function getHeaders(sh) {
  const width = Math.max(1, sh.getLastColumn());
  return sh.getRange(1,1,1,width).getValues()[0]
    .map(value => String(value || '').trim());
}

function rowToObject(headers, row) {
  return Object.fromEntries(headers.map((header,index) => [header,row[index]]));
}

function allRows() {
  const sh = applicationsSheet();
  const headers = getHeaders(sh);
  const width = headers.length;

  if (sh.getLastRow() < 2) return [];

  const values = sh.getRange(2,1,sh.getLastRow()-1,width).getValues();
  const idIndex = headers.indexOf('applicationId');

  return values
    .filter(row => idIndex >= 0 && row[idIndex])
    .map(row => rowToObject(headers,row));
}

function findRowInSheet(sh, headers, field, value) {
  const columnIndex = headers.indexOf(field);
  if (columnIndex < 0 || sh.getLastRow() < 2) return null;

  const found = sh
    .getRange(2,columnIndex+1,sh.getLastRow()-1,1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .matchCase(false)
    .findNext();

  return found ? { sh, headers, rowNumber:found.getRow() } : null;
}

function findRow(field, value) {
  const sh = applicationsSheet();
  const headers = getHeaders(sh);
  return findRowInSheet(sh, headers, field, value);
}

function readRecord(found) {
  const width = found.headers.length;
  const row = found.sh.getRange(found.rowNumber,1,1,width).getValues()[0];
  return rowToObject(found.headers,row);
}

function findApplication(applicationId) {
  const found = findRow('applicationId',String(applicationId));
  if (!found) throw new Error('Application not found');
  return readRecord(found);
}

function hash(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || '')
  );
  return bytes.map(byte => ('0'+((byte+256)%256).toString(16)).slice(-2)).join('');
}

function nextApplicationIdInSheet(sh, headers) {
  const idIndex = headers.indexOf('applicationId');
  if (idIndex < 0) throw new Error('Application ID column is missing');

  let max = 0;
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    sh.getRange(2,idIndex+1,lastRow-1,1).getDisplayValues().forEach(row => {
      const match = String(row[0] || '').match(/TFC-(\d+)/i);
      if (match) max = Math.max(max, Number(match[1]));
    });
  }

  return 'TFC-' + String(max + 1).padStart(6,'0');
}

function nextApplicationId() {
  const sh = applicationsSheet();
  const headers = getHeaders(sh);
  return nextApplicationIdInSheet(sh, headers);
}

function appendRecordToSheet(sh, headers, record) {
  const width = headers.length;
  ensureColumnCapacity(sh,width);
  const row = headers.map(header => record[header] ?? '');
  sh.getRange(sh.getLastRow()+1,1,1,width).setValues([row]);
}

function appendRecord(record) {
  const sh = applicationsSheet();
  const headers = getHeaders(sh);
  appendRecordToSheet(sh, headers, record);
}

function updateRecord(applicationId, patch) {
  const found = findRow('applicationId',String(applicationId));
  if (!found) throw new Error('Application not found');

  const width = found.headers.length;
  const row = found.sh.getRange(found.rowNumber,1,1,width).getValues()[0];

  found.headers.forEach((header,columnIndex) => {
    if (Object.prototype.hasOwnProperty.call(patch,header)) {
      row[columnIndex] = patch[header];
    }
  });

  const updatedIndex = found.headers.indexOf('updated');
  if (updatedIndex >= 0) row[updatedIndex] = new Date();

  found.sh.getRange(found.rowNumber,1,1,width).setValues([row.slice(0,width)]);
}

function createAccount(p) {
  const email = String(p.email || '').trim().toLowerCase();
  const password = String(p.password || '');
  const name = String(p.name || '').trim();
  const phone = String(p.phone || '').trim();

  if (!name) throw new Error('Name is required');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('A valid email address is required');
  if (phone.replace(/\D/g,'').length < 7) throw new Error('A valid phone number is required');
  if (password.length < 8) throw new Error('Password must contain at least 8 characters');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sh = applicationsSheet();
    const headers = getHeaders(sh);

    if (findRowInSheet(sh,headers,'email',email)) {
      throw new Error('An account already exists for this email');
    }

    const now = new Date();
    const record = {
      applicationId:nextApplicationIdInSheet(sh,headers),
      created:now,
      updated:now,
      name,
      email,
      passwordHash:hash(password),
      phone,
      business:p.business || '',
      address:p.address || '',
      city:p.city || '',
      province:p.province || '',
      postal:p.postal || '',
      industry:p.industry || '',
      revenue:p.revenue || '',
      requested:p.requested || '',
      years:p.years || '',
      purpose:p.purpose || '',
      status:'Account Created',
      statements:0,
      advisor:'',
      messageTitle:'Welcome',
      messageBody:'Your account has been created. Please complete your application and upload six recent bank statements.',
      approvedAmount:'',
      quote:'',
      term:'',
      paymentFrequency:'',
      paymentAmount:'',
      numberPayments:'',
      totalRepayment:'',
      documentsRequested:'',
      clientDecision:'',
      clientDecisionNote:'',
      clientDecisionAt:'',
      notes:'',
      driveFolderId:'',
      driveUrl:'',
      lastNotificationStatus:'',
      lastNotificationAt:'',
      lastNotificationError:''
    };

    appendRecordToSheet(sh,headers,record);
    sendNewClientSignupEmail(record);
    return { ok:true, data:safe({ ...record, documents:[] }) };
  } finally {
    lock.releaseLock();
  }
}

function clientLogin(p) {
  const email = String(p.email || '').trim().toLowerCase();
  const found = findRow('email',email);
  if (!found) throw new Error('Invalid email or password');

  const record = readRecord(found);
  if (record.passwordHash !== hash(p.password || '')) {
    throw new Error('Invalid email or password');
  }

  return { ok:true, data:safe({ ...record, documents:[] }) };
}

function getClient(p) {
  const record = findApplication(p.applicationId);
  return { ok:true, data:safe({ ...record, documents:[] }) };
}

function clientDecision(p) {
  const record = findApplication(p.applicationId);
  const email = String(p.email || '').trim().toLowerCase();
  if (email && email !== String(record.email || '').trim().toLowerCase()) {
    throw new Error('Account verification failed');
  }

  const decision = String(p.decision || '').trim();
  if (!['Proceed','Request More Information'].includes(decision)) {
    throw new Error('Please choose Proceed or Request More Information');
  }

  updateRecord(record.applicationId,{
    clientDecision:decision,
    clientDecisionNote:String(p.note || '').trim(),
    clientDecisionAt:new Date()
  });

  const fresh = findApplication(record.applicationId);
  sendClientDecisionEmail(fresh);
  return { ok:true, data:safe({ ...fresh, documents:[] }) };
}

function adminLogin(p) {
  if (CONFIG.ADMIN_PASSWORD === 'CHANGE_THIS_PASSWORD') {
    throw new Error('Change ADMIN_PASSWORD in Code.gs before deploying.');
  }

  const email = String(p.email || '').trim().toLowerCase();
  const password = String(p.password || '');

  if (email !== CONFIG.ADMIN_EMAIL.toLowerCase() || password !== CONFIG.ADMIN_PASSWORD) {
    throw new Error('Invalid admin credentials');
  }

  return { ok:true };
}

function adminList() {
  return {
    ok:true,
    data:allRows().map(record => safe({ ...record, documents:[] }))
  };
}

function adminUpdate(p) {
  findApplication(p.applicationId);
  const patch = {};

  ['status','advisor','messageTitle','messageBody','approvedAmount','quote','term','paymentFrequency',
   'paymentAmount','numberPayments','totalRepayment','documentsRequested','notes']
    .forEach(key => {
      if (Object.prototype.hasOwnProperty.call(p,key)) patch[key] = p[key];
    });

  updateRecord(p.applicationId,patch);
  let saved = findApplication(p.applicationId);
  let notification = { attempted:false, sent:false };
  const shouldNotify = ['true','1','yes'].includes(String(p.notifyClient || '').toLowerCase());

  if (shouldNotify) {
    notification = sendClientUpdateEmail(saved);
    saved = findApplication(p.applicationId);
  }

  return { ok:true, data:safe(saved), notification };
}

function adminEnsureDrive(p) {
  const record = findApplication(p.applicationId);
  const folder = ensureDriveFolder(record);
  const fresh = findApplication(p.applicationId);

  return {
    ok:true,
    data:safe({
      ...fresh,
      driveFolderId:folder.getId(),
      driveUrl:folder.getUrl()
    })
  };
}

function uploadDocument(p) {
  const record = findApplication(p.applicationId);
  const rootFolder = ensureDriveFolder(record);
  let folderName = 'Other Documents';
  if (p.type === 'statement') folderName = 'Bank Statements';
  else if (p.type === 'identification') folderName = 'Identification';
  else if (p.type === 'financial') folderName = 'Financial Statements';
  const targetFolder = childFolder(rootFolder,folderName);

  if (!p.base64) throw new Error('Missing document data');

  const blob = Utilities.newBlob(
    Utilities.base64Decode(p.base64),
    p.mimeType || 'application/pdf',
    p.fileName || 'document.pdf'
  );

  targetFolder.createFile(blob);

  if (p.type === 'statement') {
    const count = countFiles(childFolder(rootFolder,'Bank Statements'));
    updateRecord(record.applicationId,{
      statements:count,
      status:count >= CONFIG.MIN_STATEMENTS ? 'Ready for Review' : 'Statements Required',
      messageTitle:count >= CONFIG.MIN_STATEMENTS ? 'Documents Received' : 'Statements Required',
      messageBody:count >= CONFIG.MIN_STATEMENTS
        ? 'Thank you. Your statements have been received and your file is ready for review.'
        : `Please upload ${CONFIG.MIN_STATEMENTS-count} more monthly statement(s).`
    });
  }

  return { ok:true };
}

function ensureDriveFolder(record) {
  if (record.driveFolderId) {
    try { return DriveApp.getFolderById(record.driveFolderId); } catch (_) {}
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const fresh = findApplication(record.applicationId);

    if (fresh.driveFolderId) {
      try { return DriveApp.getFolderById(fresh.driveFolderId); } catch (_) {}
    }

    const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    const folder = root.createFolder(
      `${fresh.applicationId} - ${fresh.business || fresh.name || fresh.email}`
    );

    ['Bank Statements','Identification','Financial Statements','Other Documents']
      .forEach(name => folder.createFolder(name));

    updateRecord(fresh.applicationId,{
      driveFolderId:folder.getId(),
      driveUrl:folder.getUrl()
    });

    return folder;
  } finally {
    lock.releaseLock();
  }
}

function getDocuments(p) {
  return { ok:true, data:listDocuments(findApplication(p.applicationId)) };
}

function listDocuments(record) {
  if (!record.driveFolderId) return [];

  const out = [];
  try {
    walkFolder(DriveApp.getFolderById(record.driveFolderId),out);
  } catch (_) {}

  return out;
}

function walkFolder(folder,out) {
  let files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const folderName = folder.getName();
    let type = 'document';
    if (folderName === 'Bank Statements') type = 'statement';
    else if (folderName === 'Identification') type = 'identification';
    else if (folderName === 'Financial Statements') type = 'financial';
    out.push({
      name:file.getName(),
      date:file.getDateCreated(),
      url:file.getUrl(),
      type
    });
  }

  let folders = folder.getFolders();
  while (folders.hasNext()) {
    walkFolder(folders.next(),out);
  }
}

function childFolder(folder,name) {
  const iterator = folder.getFoldersByName(name);
  return iterator.hasNext() ? iterator.next() : folder.createFolder(name);
}

function countFiles(folder) {
  let count = 0;
  const files = folder.getFiles();
  while (files.hasNext()) {
    files.next();
    count++;
  }
  return count;
}

function sendClientUpdateEmail(record) {
  const email = String(record.email || '').trim();

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    const error = 'Client email address is missing or invalid.';
    updateRecord(record.applicationId,{lastNotificationError:error});
    return { attempted:true, sent:false, error };
  }

  const from = String(CONFIG.CLIENT_NOTIFICATION_FROM || '').trim().toLowerCase();
  const aliases = GmailApp.getAliases().map(alias => String(alias || '').trim().toLowerCase());
  if (!from || !aliases.includes(from)) {
    const error = `${CONFIG.CLIENT_NOTIFICATION_FROM} is not available as a Gmail Send mail as alias for the Apps Script account.`;
    updateRecord(record.applicationId,{lastNotificationError:error});
    return { attempted:true, sent:false, error };
  }

  const clientName = String(record.name || 'Client').trim();
  const subject = 'Update Available – Toronto Finance Company';
  const portalUrl = String(CONFIG.CLIENT_PORTAL_URL || '').trim();
  const body = [
    `Hello ${clientName},`,
    '',
    'There has been an update to your financing application with Toronto Finance Company.',
    '',
    'Please log in to your secure client portal to review the latest information and any action required:',
    portalUrl,
    '',
    `Application: ${record.applicationId || ''}`,
    '',
    'For your privacy, financing details are not included in this email.',
    '',
    'Toronto Finance Company'
  ].join('\n');

  const safeName = escapeEmailHtml(clientName);
  const safeApplicationId = escapeEmailHtml(record.applicationId || '');
  const safePortalUrl = escapeEmailHtml(portalUrl);
  const htmlBody = `
    <div style="font-family:Arial,sans-serif;color:#1f1f1f;line-height:1.6;max-width:620px;margin:0 auto;padding:24px">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a6a38;margin-bottom:22px">Toronto Finance Company</div>
      <h2 style="font-size:24px;font-weight:500;margin:0 0 18px">An update is available</h2>
      <p>Hello ${safeName},</p>
      <p>There has been an update to your financing application. Please sign in to your secure client portal to review the latest information and any action required.</p>
      <p style="margin:28px 0">
        <a href="${safePortalUrl}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:600">Review Your File</a>
      </p>
      <p style="font-size:13px;color:#6f675f">Application: ${safeApplicationId}</p>
      <p style="font-size:13px;color:#6f675f">For your privacy, financing details are not included in this email.</p>
      <p style="margin-top:28px">Toronto Finance Company</p>
    </div>`;

  try {
    GmailApp.sendEmail(email,subject,body,{
      from:CONFIG.CLIENT_NOTIFICATION_FROM,
      name:CONFIG.COMPANY_NAME,
      replyTo:CONFIG.CLIENT_NOTIFICATION_FROM,
      htmlBody
    });

    updateRecord(record.applicationId,{
      lastNotificationStatus:String(record.status || 'Update Sent'),
      lastNotificationAt:new Date(),
      lastNotificationError:''
    });

    return {
      attempted:true,
      sent:true,
      status:String(record.status || ''),
      sender:CONFIG.CLIENT_NOTIFICATION_FROM
    };
  } catch (err) {
    const error = err.message || String(err);
    updateRecord(record.applicationId,{lastNotificationError:error});
    return { attempted:true, sent:false, error };
  }
}

function sendApprovalEmail(record) {
  return sendClientUpdateEmail(record);
}

function escapeEmailHtml(value) {
  return String(value || '').replace(/[&<>"']/g,character => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[character]));
}

function sendNewClientSignupEmail(record) {
  const subject = `New Client Signup: ${record.applicationId} - ${record.name || 'Client'}`;
  const body = [
    'A new client account has been created on the Toronto Finance Company website.',
    '',
    `Application: ${record.applicationId || ''}`,
    `Client: ${record.name || ''}`,
    `Email: ${record.email || ''}`,
    `Phone: ${record.phone || ''}`,
    '',
    'Open the Admin CRM to review the new client file.'
  ].join('\n');

  try {
    GmailApp.sendEmail(CONFIG.SIGNUP_NOTIFICATION_EMAIL,subject,body,{
      from:CONFIG.CLIENT_NOTIFICATION_FROM,
      name:CONFIG.COMPANY_NAME,
      replyTo:String(record.email || CONFIG.SIGNUP_NOTIFICATION_EMAIL)
    });
    return { sent:true, recipient:CONFIG.SIGNUP_NOTIFICATION_EMAIL };
  } catch (err) {
    console.error('Signup notification failed:', err.message || String(err));
    return { sent:false, error:err.message || String(err) };
  }
}

function testSignupNotification() {
  const testRecord = {
    applicationId:'TFC-TEST',
    name:'Signup Notification Test',
    email:CONFIG.SIGNUP_NOTIFICATION_EMAIL,
    phone:'Test'
  };
  const result = sendNewClientSignupEmail(testRecord);
  Logger.log(JSON.stringify(result));
  if (!result.sent) throw new Error(result.error || 'Signup notification test failed');
  return result;
}

function sendClientDecisionEmail(record) {
  const decision = String(record.clientDecision || 'Client Response');
  const subject = `${decision}: ${record.applicationId} - ${record.business || record.name || 'Client'}`;
  const body = [
    'A client has responded to financing available in the Toronto Finance Company portal.',
    '',
    `Application: ${record.applicationId}`,
    `Client: ${record.name || ''}`,
    `Business: ${record.business || ''}`,
    `Response: ${decision}`,
    `Client note: ${record.clientDecisionNote || 'No note provided'}`,
    '',
    'Open the Admin CRM to review the file and enter any additional documents required.'
  ].join('\n');

  try {
    MailApp.sendEmail(CONFIG.ADMIN_EMAIL,subject,body,{
      name:CONFIG.COMPANY_NAME,
      replyTo:String(record.email || CONFIG.ADMIN_EMAIL)
    });
  } catch (_) {}
}

function safe(record) {
  const result = { ...record };
  delete result.passwordHash;
  delete result.password;
  return result;
}

/*
 * RUN THIS ONCE MANUALLY AFTER PASTING THE FILE:
 * Select authorizeGmailAlias in the Apps Script function dropdown and click Run.
 * Approve the requested Gmail permissions.
 */
function authorizeGmailAlias() {
  const target = String(CONFIG.CLIENT_NOTIFICATION_FROM || '').trim().toLowerCase();
  const aliases = GmailApp.getAliases();
  const normalized = aliases.map(alias => String(alias || '').trim().toLowerCase());

  Logger.log('Available Gmail aliases: ' + aliases.join(', '));

  if (!normalized.includes(target)) {
    throw new Error(
      CONFIG.CLIENT_NOTIFICATION_FROM +
      ' is not available under Gmail > Settings > Accounts and Import > Send mail as.'
    );
  }

  Logger.log('AUTHORIZED: ' + CONFIG.CLIENT_NOTIFICATION_FROM);
  return 'AUTHORIZED: ' + CONFIG.CLIENT_NOTIFICATION_FROM;
}