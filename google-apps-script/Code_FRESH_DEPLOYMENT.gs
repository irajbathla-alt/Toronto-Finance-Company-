const CONFIG = {
  SHEET_ID: '1pRN82iNCVpU31DJQA3xUrMVkMcPRPv1Rl69WH3VRco4',
  ROOT_FOLDER_ID: '1ao4Tlk65yxtr8yHGJaNGqyKPOHYFfXjb',
  ADMIN_EMAIL: 'admin@torontofinance.ca',
  ADMIN_PASSWORD: 'CHANGE_THIS_ADMIN_PASSWORD',
  CLIENT_PORTAL_URL: 'https://irajbathla-alt.github.io/Toronto-Finance-Company-/client-dashboard.html',
  COMPANY_NAME: 'Toronto Finance Company Inc.',
  MIN_STATEMENTS: 6
};

const HEADERS = [
  'applicationId','created','updated','name','email','passwordHash','phone','business',
  'address','city','province','postal','industry','revenue','requested','years','purpose',
  'status','statements','advisor','messageTitle','messageBody','approvedAmount','quote','notes',
  'driveFolderId','driveUrl','lastNotificationStatus','lastNotificationAt','lastNotificationError'
];

const APPROVAL_EMAIL_STATUSES = ['Conditional Approval','Approved'];

function doGet(e) {
  try {
    const p = parseGet(e);
    if (!p.action || p.action === 'health') return output(healthCheck(), p.callback);
    const actions = {
      createAccount, clientLogin, getClient, adminLogin, adminList,
      adminUpdate, adminEnsureDrive, getDocuments, repairApplicationsSchema
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
      createAccount, clientLogin, getClient, uploadDocument, adminLogin,
      adminList, adminUpdate, adminEnsureDrive, getDocuments, repairApplicationsSchema
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
    return ContentService.createTextOutput(`${cb}(${JSON.stringify(value)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json(value);
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function healthCheck() {
  const out = {
    ok:true,
    service:'Toronto Finance Company CRM Fresh 1.0',
    schemaSafe:true,
    lazyDriveFolders:true,
    approvalEmailEnabled:true
  };
  try {
    const sh = applicationsSheet();
    const h = getHeaders(sh);
    out.spreadsheetName = sh.getParent().getName();
    out.applicationsSheet = sh.getName();
    out.schemaColumns = h.length;
    out.sheetWritable = true;
  } catch (err) {
    out.ok = false;
    out.sheetError = err.message || String(err);
  }
  try {
    out.rootFolderName = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID).getName();
    out.driveWritable = true;
  } catch (err) {
    out.ok = false;
    out.driveError = err.message || String(err);
  }
  out.adminPasswordConfigured = getAdminPassword() !== 'CHANGE_THIS_ADMIN_PASSWORD';
  return out;
}

function initializeFreshDeployment() {
  const schema = repairApplicationsSchema();
  return { ok:true, schema, health:healthCheck() };
}

function setAdminPassword(password) {
  if (!password || String(password).length < 8) throw new Error('Admin password must be at least 8 characters.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', String(password));
  return { ok:true };
}

function getAdminPassword() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || CONFIG.ADMIN_PASSWORD;
}

function ensureColumnCapacity(sh, requiredColumns) {
  const max = sh.getMaxColumns();
  if (max < requiredColumns) sh.insertColumnsAfter(max, requiredColumns - max);
}

function applicationsSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sh = ss.getSheetByName('Applications');
  if (!sh) {
    sh = ss.insertSheet('Applications');
    ensureColumnCapacity(sh, HEADERS.length);
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  } else {
    ensureApplicationsSchema(sh);
  }
  return sh;
}

function ensureApplicationsSchema(sh) {
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    ensureColumnCapacity(sh, HEADERS.length);
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    return HEADERS.slice();
  }

  const existingWidth = Math.max(1, sh.getLastColumn());
  const current = sh.getRange(1,1,1,existingWidth).getValues()[0].map(value => String(value || '').trim());
  const merged = current.slice();
  let changed = false;

  HEADERS.forEach(header => {
    if (!merged.includes(header)) {
      merged.push(header);
      changed = true;
    }
  });

  ensureColumnCapacity(sh, merged.length);
  if (changed || merged.length !== existingWidth) {
    sh.getRange(1,1,1,merged.length).setValues([merged]);
  }
  return merged;
}

function repairApplicationsSchema() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sh = ss.getSheetByName('Applications');
  if (!sh) {
    sh = ss.insertSheet('Applications');
    ensureColumnCapacity(sh, HEADERS.length);
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  }
  const headers = ensureApplicationsSchema(sh);
  return {
    ok:true,
    columns:headers.length,
    stableHeaders:HEADERS.length,
    preservedExtraColumns:Math.max(0, headers.length - HEADERS.length)
  };
}

function getHeaders(sh) {
  return ensureApplicationsSchema(sh);
}

function rowToObject(headers, row) {
  return Object.fromEntries(headers.map((header,index) => [header,row[index]]));
}

function rows() {
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

function findRow(field, value) {
  const sh = applicationsSheet();
  const headers = getHeaders(sh);
  const columnIndex = headers.indexOf(field);
  if (columnIndex < 0 || sh.getLastRow() < 2) return null;
  const found = sh.getRange(2,columnIndex+1,sh.getLastRow()-1,1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .matchCase(false)
    .findNext();
  return found ? { sh, headers, rowNumber:found.getRow() } : null;
}

function readRecordAt(found) {
  const width = found.headers.length;
  const row = found.sh.getRange(found.rowNumber,1,1,width).getValues()[0];
  return rowToObject(found.headers,row);
}

function hash(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value));
  return bytes.map(byte => ('0'+((byte+256)%256).toString(16)).slice(-2)).join('');
}

function nextId(existingRows) {
  let max = 0;
  existingRows.forEach(row => {
    const match = String(row.applicationId || '').match(/TFC-(\d+)/i);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return 'TFC-' + String(max + 1).padStart(6,'0');
}

function createAccount(p) {
  const email = String(p.email || '').trim().toLowerCase();
  const password = String(p.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('A valid email address is required');
  if (password.length < 8) throw new Error('Password must contain at least 8 characters');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (findRow('email',email)) throw new Error('An account already exists for this email');
    const now = new Date();
    const record = {
      ...p,
      email,
      applicationId:nextId(rows()),
      created:now,
      updated:now,
      passwordHash:hash(password),
      status:'Account Created',
      statements:0,
      messageTitle:'Welcome',
      messageBody:'Your account has been created. Please complete your application and upload six recent bank statements.',
      driveFolderId:'',
      driveUrl:'',
      lastNotificationStatus:'',
      lastNotificationAt:'',
      lastNotificationError:''
    };
    delete record.password;
    appendRecord(record);
    return { ok:true, data:safe({ ...record, documents:[] }) };
  } finally {
    lock.releaseLock();
  }
}

function appendRecord(record) {
  const sh = applicationsSheet();
  const headers = getHeaders(sh);
  const width = headers.length;
  ensureColumnCapacity(sh,width);
  sh.getRange(sh.getLastRow()+1,1,1,width).setValues([headers.map(header => record[header] ?? '')]);
}

function clientLogin(p) {
  const email = String(p.email || '').trim().toLowerCase();
  const found = findRow('email',email);
  if (!found) throw new Error('Invalid email or password');
  const record = readRecordAt(found);
  if (record.passwordHash !== hash(p.password || '')) throw new Error('Invalid email or password');
  return { ok:true, data:safe({ ...record, documents:listDocs(record) }) };
}

function getClient(p) {
  const record = find(p.applicationId);
  return { ok:true, data:safe({ ...record, documents:listDocs(record) }) };
}

function adminLogin(p) {
  if (getAdminPassword() === 'CHANGE_THIS_ADMIN_PASSWORD') {
    throw new Error('Admin password is not configured. Run setAdminPassword() once in Apps Script.');
  }
  if (String(p.email || '').trim().toLowerCase() !== CONFIG.ADMIN_EMAIL.toLowerCase() || String(p.password || '') !== getAdminPassword()) {
    throw new Error('Invalid admin credentials');
  }
  return { ok:true };
}

function adminList() {
  return { ok:true, data:rows().map(record => safe({ ...record, documents:[] })) };
}

function getDocuments(p) {
  return { ok:true, data:listDocs(find(p.applicationId)) };
}

function adminUpdate(p) {
  const before = find(p.applicationId);
  const patch = {};
  ['status','advisor','messageTitle','messageBody','approvedAmount','quote','notes']
    .forEach(key => { if (Object.prototype.hasOwnProperty.call(p,key)) patch[key] = p[key]; });

  update(p.applicationId,patch);
  const saved = find(p.applicationId);
  const nextStatus = String(saved.status || '');
  const alreadyNotified = String(before.lastNotificationStatus || '') === nextStatus;
  let notification = { attempted:false, sent:false };

  if (APPROVAL_EMAIL_STATUSES.includes(nextStatus) && !alreadyNotified) {
    notification = sendApprovalNotification(saved);
  }

  return { ok:true, data:safe(find(p.applicationId)), notification };
}

function adminEnsureDrive(p) {
  const record = find(p.applicationId);
  const folder = ensureDriveFolder(record);
  const fresh = find(p.applicationId);
  return { ok:true, data:safe({ ...fresh, driveFolderId:folder.getId(), driveUrl:folder.getUrl() }) };
}

function uploadDocument(p) {
  const record = find(p.applicationId);
  const folder = ensureDriveFolder(record);
  const target = p.type === 'statement' ? getChild(folder,'Bank Statements') : getChild(folder,'Other Documents');
  const blob = Utilities.newBlob(
    Utilities.base64Decode(p.base64),
    p.mimeType || 'application/pdf',
    p.fileName || 'document.pdf'
  );
  target.createFile(blob);

  if (p.type === 'statement') {
    const count = countFiles(getChild(folder,'Bank Statements'));
    update(record.applicationId,{
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
    const fresh = find(record.applicationId);
    if (fresh.driveFolderId) {
      try { return DriveApp.getFolderById(fresh.driveFolderId); } catch (_) {}
    }
    const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    const folder = root.createFolder(`${fresh.applicationId} - ${fresh.business || fresh.name || fresh.email}`);
    ['Bank Statements','Identification','Financial Statements','Other Documents']
      .forEach(name => folder.createFolder(name));
    update(fresh.applicationId,{driveFolderId:folder.getId(),driveUrl:folder.getUrl()});
    return folder;
  } finally {
    lock.releaseLock();
  }
}

function sendApprovalNotification(record) {
  const email = String(record.email || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    const error = 'Client email address is missing or invalid.';
    update(record.applicationId,{lastNotificationError:error});
    return { attempted:true, sent:false, error };
  }

  const status = String(record.status || 'Approved');
  const clientName = String(record.name || 'Client').trim();
  const subject = status === 'Approved'
    ? 'Your financing approval is ready to review'
    : 'A conditional approval is ready to review';
  const body = [
    `Hello ${clientName},`,'',
    'There is an important update regarding your financing application with Toronto Finance Company.','',
    'Please log in to your secure client dashboard to review the approval and any conditions or next steps:',
    CONFIG.CLIENT_PORTAL_URL,'',
    'For your privacy, approval details are not included in this email.','',
    CONFIG.COMPANY_NAME
  ].join('\n');
  const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#17130f;line-height:1.6"><div style="background:#17130f;color:#fff;padding:22px 26px"><div style="font-size:18px">${escapeHtml(CONFIG.COMPANY_NAME)}</div></div><div style="padding:28px 26px;border:1px solid #e6ddd2;border-top:0"><p>Hello ${escapeHtml(clientName)},</p><h2 style="font-weight:500">${escapeHtml(status)} Available</h2><p>There is an important update regarding your financing application.</p><p>Please log in to your secure client dashboard to review the approval and next steps.</p><p style="margin:28px 0"><a href="${escapeHtml(CONFIG.CLIENT_PORTAL_URL)}" style="display:inline-block;background:#17130f;color:#fff;text-decoration:none;padding:13px 22px;border-radius:999px">Log In to Client Portal</a></p><p style="font-size:12px;color:#786f65">For your privacy, approval details are not included in this email.</p></div></div>`;

  try {
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Daily email sending quota has been reached.');
    MailApp.sendEmail(email,subject,body,{htmlBody,name:CONFIG.COMPANY_NAME,replyTo:CONFIG.ADMIN_EMAIL});
    const sentAt = new Date();
    update(record.applicationId,{lastNotificationStatus:status,lastNotificationAt:sentAt,lastNotificationError:''});
    return { attempted:true, sent:true, status, sentAt };
  } catch (err) {
    const error = err.message || String(err);
    update(record.applicationId,{lastNotificationError:error});
    return { attempted:true, sent:false, error };
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function find(id) {
  const found = findRow('applicationId',String(id));
  if (!found) throw new Error('Application not found');
  return readRecordAt(found);
}

function update(id, patch) {
  const found = findRow('applicationId',String(id));
  if (!found) throw new Error('Application not found');

  const width = found.headers.length;
  ensureColumnCapacity(found.sh,width);
  const row = found.sh.getRange(found.rowNumber,1,1,width).getValues()[0];
  while (row.length < width) row.push('');

  found.headers.forEach((header,columnIndex) => {
    if (Object.prototype.hasOwnProperty.call(patch,header)) row[columnIndex] = patch[header];
  });

  const updatedIndex = found.headers.indexOf('updated');
  if (updatedIndex >= 0) row[updatedIndex] = new Date();

  found.sh.getRange(found.rowNumber,1,1,width).setValues([row.slice(0,width)]);
}

function getChild(folder,name) {
  const iterator = folder.getFoldersByName(name);
  return iterator.hasNext() ? iterator.next() : folder.createFolder(name);
}

function countFiles(folder) {
  let count = 0;
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    iterator.next();
    count++;
  }
  return count;
}

function listDocs(record) {
  if (!record.driveFolderId) return [];
  const out = [];
  try { walk(DriveApp.getFolderById(record.driveFolderId),out); } catch (_) {}
  return out;
}

function walk(folder,out) {
  let files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    out.push({
      name:file.getName(),
      date:file.getDateCreated(),
      url:file.getUrl(),
      type:folder.getName() === 'Bank Statements' ? 'statement' : 'document'
    });
  }
  let folders = folder.getFolders();
  while (folders.hasNext()) walk(folders.next(),out);
}

function safe(record) {
  const result = { ...record };
  delete result.passwordHash;
  delete result.password;
  return result;
}
