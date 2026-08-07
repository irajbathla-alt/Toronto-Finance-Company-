const CONFIG = {
  SHEET_ID: '1pRN82iNCVpU31DJQA3xUrMVkMcPRPv1Rl69WH3VRco4',
  ROOT_FOLDER_ID: '1ao4Tlk65yxtr8yHGJaNGqyKPOHYFfXjb',
  ADMIN_EMAIL: 'admin@torontofinance.ca',
  ADMIN_PASSWORD: 'CHANGE_THIS_ADMIN_PASSWORD',
  CLIENT_PORTAL_URL: 'https://irajbathla-alt.github.io/Toronto-Finance-Company-/client-dashboard.html',
  COMPANY_NAME: 'Toronto Finance Company Inc.',
  MIN_STATEMENTS: 6,
  SESSION_HOURS: 8
};

const APP_HEADERS = [
  'applicationId','created','updated','name','email','passwordHash','phone','business',
  'address','city','province','postal','industry','revenue','requested','years','purpose',
  'status','statements','advisor','messageTitle','messageBody','approvedAmount','quote','notes',
  'driveFolderId','driveUrl','lastNotificationStatus','lastNotificationAt','lastNotificationError',
  'lastNotificationQueuedStatus','revision','nextAction','stageUpdatedAt','signatureConfirmed',
  'signatureConfirmedAt','driveIndexedAt'
];
const DOC_HEADERS = ['documentId','applicationId','fileId','name','type','mimeType','created','url','folderName'];
const ACTIVITY_HEADERS = ['activityId','created','applicationId','actor','action','fromStatus','toStatus','detail'];
const NOTIFICATION_HEADERS = ['notificationId','created','status','applicationId','to','template','attempts','lastError','sentAt'];
const APPROVAL_STATUSES = ['Conditional Approval','Approved'];
const EARLY_STATUSES = ['Account Created','Statements Required','Ready for Review'];
const OPERATION_TTL = 300;

let _ss;
const _sheetCache = {};
const _headerCache = {};

function doGet(e) {
  try {
    const p = parseGet(e);
    if (!p.action || p.action === 'health') return output(healthCheck(), p.callback);
    if (p.action === 'operationResult') return output(operationResult(p), p.callback);
    const result = routeAction(p.action, p);
    return output(result, p.callback);
  } catch (err) {
    return output({ ok:false, error:err.message || String(err) }, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  let p = {};
  try {
    p = parsePost(e);
    const result = routeAction(p.action, p);
    if (p.requestId) saveOperationResult(p.requestId, result);
    return json(result);
  } catch (err) {
    const result = { ok:false, error:err.message || String(err) };
    if (p.requestId) saveOperationResult(p.requestId, result);
    return json(result);
  }
}

function routeAction(action, p) {
  const actions = {
    createAccount, clientLogin, adminLogin, getClient, clientConfirmSignature,
    uploadDocument, adminList, adminUpdate, adminEnsureDrive, getDocuments, getActivity
  };
  if (!actions[action]) throw new Error('Unknown action');
  return actions[action](p);
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
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function saveOperationResult(requestId, result) {
  CacheService.getScriptCache().put(`op:${requestId}`, JSON.stringify(result), OPERATION_TTL);
}

function operationResult(p) {
  if (!p.requestId) throw new Error('requestId is required');
  const value = CacheService.getScriptCache().get(`op:${p.requestId}`);
  if (!value) return { ok:true, pending:true };
  // Do not delete here. The browser may lose a JSONP response after Apps Script
  // has served it. Keeping the result until TTL expiry makes polling idempotent
  // and allows the next retry to receive the same completed operation.
  return JSON.parse(value);
}

function setupSystem() {
  ensureSheet('Applications', APP_HEADERS);
  ensureSheet('Documents', DOC_HEADERS);
  ensureSheet('Activity', ACTIVITY_HEADERS);
  ensureSheet('Notifications', NOTIFICATION_HEADERS);
  ensureSessionSecret();
  initializeSequence();
  ensureNotificationTrigger();
  return healthCheck();
}

function setAdminPassword(password) {
  if (!password || String(password).length < 8) throw new Error('Admin password must be at least 8 characters.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', String(password));
  return { ok:true };
}

function healthCheck() {
  const out = {
    ok:true,
    service:'Toronto Finance Company CRM v2.1',
    architecture:'Apps Script + Sheets + Drive',
    minimumStatements:CONFIG.MIN_STATEMENTS,
    operationResultRetryable:true
  };
  try {
    out.spreadsheetName = db().getName();
    ['Applications','Documents','Activity','Notifications'].forEach(name => ensureSheet(name, headersFor(name)));
    out.sheetWritable = true;
  } catch (err) {
    out.ok = false;
    out.sheetError = err.message;
  }
  try {
    out.rootFolderName = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID).getName();
    out.driveWritable = true;
  } catch (err) {
    out.ok = false;
    out.driveError = err.message;
  }
  out.notificationTriggerInstalled = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'processNotificationQueue');
  out.sessionSecretConfigured = Boolean(PropertiesService.getScriptProperties().getProperty('SESSION_SECRET'));
  out.adminPasswordConfigured = getAdminPassword() !== 'CHANGE_THIS_ADMIN_PASSWORD';
  return out;
}

function db() {
  if (!_ss) _ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  return _ss;
}

function headersFor(name) {
  if (name === 'Applications') return APP_HEADERS;
  if (name === 'Documents') return DOC_HEADERS;
  if (name === 'Activity') return ACTIVITY_HEADERS;
  return NOTIFICATION_HEADERS;
}

function ensureSheet(name, expectedHeaders) {
  if (_sheetCache[name]) return _sheetCache[name];
  let sh = db().getSheetByName(name);
  if (!sh) sh = db().insertSheet(name);
  const lastColumn = sh.getLastColumn();
  let headers = lastColumn ? sh.getRange(1,1,1,lastColumn).getValues()[0].map(String) : [];
  if (!headers.length || !headers.some(Boolean)) headers = [];
  let changed = false;
  expectedHeaders.forEach(header => {
    if (!headers.includes(header)) { headers.push(header); changed = true; }
  });
  if (changed || sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  _sheetCache[name] = sh;
  _headerCache[name] = headers;
  return sh;
}

function sheet(name) { return ensureSheet(name, headersFor(name)); }
function headers(name) {
  sheet(name);
  return _headerCache[name] || sheet(name).getRange(1,1,1,sheet(name).getLastColumn()).getValues()[0].map(String);
}

function rowToObject(name, values) {
  const h = headers(name);
  return Object.fromEntries(h.map((key,index) => [key, values[index]]));
}

function appendObject(name, record) {
  const sh = sheet(name);
  const h = headers(name);
  sh.appendRow(h.map(key => record[key] ?? ''));
}

function findApplicationById(id) {
  const cache = CacheService.getScriptCache();
  const key = `app:${id}`;
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);
  const found = findApplicationRange('applicationId', String(id));
  if (!found) throw new Error('Application not found');
  const record = rowToObject('Applications', found.getValues()[0]);
  putApplicationCache(record);
  return record;
}

function findApplicationByEmail(email) {
  const found = findApplicationRange('email', String(email).trim().toLowerCase());
  return found ? rowToObject('Applications', found.getValues()[0]) : null;
}

function findApplicationRange(field, value) {
  const sh = sheet('Applications');
  const h = headers('Applications');
  const index = h.indexOf(field);
  if (index < 0 || sh.getLastRow() < 2) return null;
  const found = sh.getRange(2,index+1,sh.getLastRow()-1,1)
    .createTextFinder(String(value)).matchEntireCell(true).matchCase(false).findNext();
  return found ? sh.getRange(found.getRow(),1,1,h.length) : null;
}

function putApplicationCache(record) {
  try { CacheService.getScriptCache().put(`app:${record.applicationId}`, JSON.stringify(record), 120); } catch (_) {}
}

function invalidateApplicationCaches(id) {
  const cache = CacheService.getScriptCache();
  cache.remove(`app:${id}`);
  cache.remove('admin:list');
}

function allApplications() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('admin:list');
  if (cached) return JSON.parse(cached);
  const sh = sheet('Applications');
  if (sh.getLastRow() < 2) return [];
  const h = headers('Applications');
  const values = sh.getRange(2,1,sh.getLastRow()-1,h.length).getValues();
  const records = values.filter(row => row[h.indexOf('applicationId')]).map(row => rowToObject('Applications',row));
  try {
    const text = JSON.stringify(records);
    if (text.length < 90000) cache.put('admin:list',text,20);
  } catch (_) {}
  return records;
}

function hash(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value));
  return bytes.map(byte => ('0'+((byte+256)%256).toString(16)).slice(-2)).join('');
}

function initializeSequence() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('APP_SEQUENCE')) return Number(props.getProperty('APP_SEQUENCE'));
  const sh = sheet('Applications');
  const h = headers('Applications');
  const index = h.indexOf('applicationId');
  let max = 0;
  if (sh.getLastRow() >= 2) {
    sh.getRange(2,index+1,sh.getLastRow()-1,1).getValues().flat().forEach(id => {
      const match = String(id).match(/TFC-(\d+)/i);
      if (match) max = Math.max(max,Number(match[1]));
    });
  }
  props.setProperty('APP_SEQUENCE',String(max));
  return max;
}

function nextApplicationId() {
  const props = PropertiesService.getScriptProperties();
  const next = initializeSequence() + 1;
  props.setProperty('APP_SEQUENCE',String(next));
  return `TFC-${String(next).padStart(6,'0')}`;
}

function getAdminPassword() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || CONFIG.ADMIN_PASSWORD;
}

function ensureSessionSecret() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('SESSION_SECRET');
  if (!secret) {
    secret = `${Utilities.getUuid()}${Utilities.getUuid()}${new Date().getTime()}`;
    props.setProperty('SESSION_SECRET',secret);
  }
  return secret;
}

function issueSession(role, applicationId, email) {
  const payload = {
    role,
    applicationId:applicationId || '',
    email:email || '',
    exp:Date.now() + CONFIG.SESSION_HOURS*60*60*1000,
    nonce:Utilities.getUuid()
  };
  const encoded = Utilities.base64EncodeWebSafe(JSON.stringify(payload)).replace(/=+$/,'');
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(encoded,ensureSessionSecret())).replace(/=+$/,'');
  return { token:`${encoded}.${signature}`, role, applicationId:payload.applicationId, email:payload.email, expiresAt:payload.exp };
}

function verifySession(token, role, applicationId) {
  if (!token) throw new Error('Secure session required');
  const parts = String(token).split('.');
  if (parts.length !== 2) throw new Error('Invalid session');
  const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0],ensureSessionSecret())).replace(/=+$/,'');
  if (expected !== parts[1]) throw new Error('Invalid session');
  let payload;
  try { payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); }
  catch (_) { throw new Error('Invalid session'); }
  if (Date.now() > Number(payload.exp||0)) throw new Error('Session expired');
  if (role && payload.role !== role) throw new Error('Unauthorized');
  if (applicationId && payload.role !== 'admin' && String(payload.applicationId) !== String(applicationId)) throw new Error('Unauthorized application');
  return payload;
}

function safe(record) {
  const out = { ...record };
  delete out.passwordHash;
  delete out.password;
  return out;
}

function nextActionFor(record) {
  const status = String(record.status || 'Account Created');
  const signed = String(record.signatureConfirmed).toLowerCase() === 'true' || record.signatureConfirmed === true;
  const count = Number(record.statements || 0);
  if (status === 'Declined') return 'Contact your advisor to discuss available next steps.';
  if (status === 'Funded') return 'No action required. Your financing file is complete.';
  if (status === 'Approved') return 'Review your approval and contact your advisor to complete the next steps.';
  if (status === 'Conditional Approval') return 'Review the conditional approval and any outstanding conditions.';
  if (status === 'Additional Documents Required') return 'Review your advisor message and provide the requested documents.';
  if (['Under Review','Ready for Review'].includes(status)) return 'No action required. Your application is being reviewed.';
  if (!signed) return 'Review and sign your financing application.';
  if (count < CONFIG.MIN_STATEMENTS) return `Upload ${CONFIG.MIN_STATEMENTS-count} remaining monthly bank statement${CONFIG.MIN_STATEMENTS-count===1?'':'s'}.`;
  return 'No action required. Your application is ready for review.';
}

function createAccount(p) {
  const email = String(p.email||'').trim().toLowerCase();
  const password = String(p.password||'');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('A valid email address is required');
  if (password.length < 8) throw new Error('Password must contain at least 8 characters');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (findApplicationByEmail(email)) throw new Error('An account already exists for this email');
    const now = new Date();
    const record = {
      ...p,
      applicationId:nextApplicationId(), created:now, updated:now, email,
      passwordHash:hash(password), status:'Account Created', statements:0,
      messageTitle:'Welcome',
      messageBody:'Your account has been created. Please complete your application and upload six recent bank statements.',
      revision:1, stageUpdatedAt:now, signatureConfirmed:false, nextAction:'Review and sign your financing application.',
      driveFolderId:'', driveUrl:'', driveIndexedAt:'', lastNotificationStatus:'', lastNotificationAt:'',
      lastNotificationError:'', lastNotificationQueuedStatus:''
    };
    delete record.password;
    appendObject('Applications',record);
    invalidateApplicationCaches(record.applicationId);
    logActivity(record.applicationId,'client','Account Created','','Account Created','Secure client account created.');
    return { ok:true, data:safe(record), session:issueSession('client',record.applicationId,email) };
  } finally { lock.releaseLock(); }
}

function clientLogin(p) {
  const email = String(p.email||'').trim().toLowerCase();
  const record = findApplicationByEmail(email);
  if (!record || record.passwordHash !== hash(p.password||'')) throw new Error('Invalid email or password');
  return { ok:true, data:safe(record), session:issueSession('client',record.applicationId,email) };
}

function adminLogin(p) {
  if (String(p.email||'').trim().toLowerCase() !== CONFIG.ADMIN_EMAIL.toLowerCase() || String(p.password||'') !== getAdminPassword()) {
    throw new Error('Invalid admin credentials');
  }
  if (getAdminPassword() === 'CHANGE_THIS_ADMIN_PASSWORD') throw new Error('Admin password is not configured. Run setAdminPassword() in Apps Script.');
  return { ok:true, session:issueSession('admin','',CONFIG.ADMIN_EMAIL) };
}

function getClient(p) {
  verifySession(p.token,null,p.applicationId);
  const record = findApplicationById(p.applicationId);
  return { ok:true, data:safe(record) };
}

function clientConfirmSignature(p) {
  verifySession(p.token,'client',p.applicationId);
  const before = findApplicationById(p.applicationId);
  const patch = { signatureConfirmed:true, signatureConfirmedAt:new Date() };
  const preview = { ...before, ...patch };
  patch.nextAction = nextActionFor(preview);
  const record = updateApplication(p.applicationId,patch);
  logActivity(p.applicationId,'client','Signature Confirmed',before.status,record.status,'Client confirmed completion of the electronic signature step.');
  return { ok:true, data:safe(record) };
}

function adminList(p) {
  verifySession(p.token,'admin');
  return { ok:true, data:allApplications().map(safe) };
}

function updateApplication(id, patch, expectedRevision) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const range = findApplicationRange('applicationId',String(id));
    if (!range) throw new Error('Application not found');
    const h = headers('Applications');
    const values = range.getValues()[0];
    const current = rowToObject('Applications',values);
    const currentRevision = Number(current.revision||0);
    if (expectedRevision !== undefined && expectedRevision !== null && Number(expectedRevision) !== currentRevision) {
      throw new Error('This application changed in another session. Refresh before saving again.');
    }
    const next = { ...current, ...patch };
    const now = new Date();
    next.updated = now;
    next.revision = currentRevision + 1;
    if (Object.prototype.hasOwnProperty.call(patch,'status') && String(patch.status) !== String(current.status)) next.stageUpdatedAt = now;
    const row = h.map(key => next[key] ?? '');
    range.setValues([row]);
    const record = rowToObject('Applications',row);
    invalidateApplicationCaches(id);
    putApplicationCache(record);
    return record;
  } finally { lock.releaseLock(); }
}

function updateApplicationSystem(id, patch) {
  const range = findApplicationRange('applicationId',String(id));
  if (!range) return;
  const h = headers('Applications');
  const row = range.getValues()[0];
  h.forEach((key,index) => { if (Object.prototype.hasOwnProperty.call(patch,key)) row[index] = patch[key]; });
  range.setValues([row]);
  invalidateApplicationCaches(id);
}

function adminUpdate(p) {
  verifySession(p.token,'admin');
  const before = findApplicationById(p.applicationId);
  const allowed = ['status','advisor','messageTitle','messageBody','approvedAmount','quote','notes'];
  const patch = {};
  allowed.forEach(key => { if (Object.prototype.hasOwnProperty.call(p,key)) patch[key] = p[key]; });
  const nextStatus = String(patch.status || before.status || 'Account Created');
  const statusChanged = nextStatus !== String(before.status||'');
  const shouldQueueApproval = statusChanged && APPROVAL_STATUSES.includes(nextStatus) &&
    String(before.lastNotificationStatus||'') !== nextStatus && String(before.lastNotificationQueuedStatus||'') !== nextStatus;
  const preview = { ...before, ...patch };
  patch.nextAction = nextActionFor(preview);
  if (shouldQueueApproval) patch.lastNotificationQueuedStatus = nextStatus;
  const record = updateApplication(p.applicationId,patch,p.revision === '' ? undefined : p.revision);
  const detail = statusChanged
    ? `Stage changed from ${before.status||'—'} to ${record.status}. Client message: ${record.messageTitle||'Updated'}`
    : `Client-facing information updated. Message: ${record.messageTitle||'Updated'}`;
  logActivity(record.applicationId,'admin',statusChanged?'Stage Updated':'Application Updated',before.status,record.status,detail);
  let notificationQueued = false;
  if (shouldQueueApproval) {
    queueApprovalNotification(record);
    notificationQueued = true;
  }
  return { ok:true, data:safe(record), notificationQueued };
}

function ensureDriveFolder(record) {
  if (record.driveFolderId) {
    try { return DriveApp.getFolderById(record.driveFolderId); } catch (_) {}
  }
  const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const folder = root.createFolder(`${record.applicationId} - ${record.business||record.name||record.email}`);
  ['Bank Statements','Identification','Financial Statements','Other Documents'].forEach(name => folder.createFolder(name));
  updateApplicationSystem(record.applicationId,{driveFolderId:folder.getId(),driveUrl:folder.getUrl(),driveIndexedAt:new Date()});
  return folder;
}

function adminEnsureDrive(p) {
  verifySession(p.token,'admin');
  const record = findApplicationById(p.applicationId);
  const folder = ensureDriveFolder(record);
  const fresh = findApplicationById(p.applicationId);
  logActivity(p.applicationId,'admin','Drive Folder Ready',fresh.status,fresh.status,'Client Google Drive folder is available.');
  return { ok:true, data:safe({ ...fresh, driveFolderId:folder.getId(), driveUrl:folder.getUrl() }) };
}

function getChild(folder,name) {
  const iterator = folder.getFoldersByName(name);
  return iterator.hasNext() ? iterator.next() : folder.createFolder(name);
}

function uploadDocument(p) {
  const session = verifySession(p.token,null,p.applicationId);
  const record = findApplicationById(p.applicationId);
  if (session.role === 'client' && !(String(record.signatureConfirmed).toLowerCase()==='true' || record.signatureConfirmed===true)) {
    throw new Error('Please complete the signature step before uploading statements.');
  }
  const folder = ensureDriveFolder(record);
  const folderName = p.type === 'statement' ? 'Bank Statements' : 'Other Documents';
  const target = getChild(folder,folderName);
  const blob = Utilities.newBlob(Utilities.base64Decode(p.base64),p.mimeType||'application/pdf',p.fileName||'document.pdf');
  const file = target.createFile(blob);
  appendObject('Documents',{
    documentId:`DOC-${Utilities.getUuid()}`, applicationId:record.applicationId, fileId:file.getId(),
    name:file.getName(), type:p.type||'document', mimeType:file.getMimeType(), created:new Date(),
    url:file.getUrl(), folderName
  });
  let patch = {};
  if (p.type === 'statement') {
    const count = Number(record.statements||0)+1;
    patch.statements = count;
    const preview = { ...record, statements:count };
    if (EARLY_STATUSES.includes(String(record.status||''))) {
      patch.status = count >= CONFIG.MIN_STATEMENTS ? 'Ready for Review' : 'Statements Required';
      patch.messageTitle = count >= CONFIG.MIN_STATEMENTS ? 'Documents Received' : 'Statements Required';
      patch.messageBody = count >= CONFIG.MIN_STATEMENTS
        ? 'Thank you. Your required bank statements have been received and your application is ready for review.'
        : `Please upload ${CONFIG.MIN_STATEMENTS-count} more monthly statement${CONFIG.MIN_STATEMENTS-count===1?'':'s'}.`;
      preview.status = patch.status;
    }
    patch.nextAction = nextActionFor({ ...preview, ...patch });
  }
  const updated = Object.keys(patch).length ? updateApplication(record.applicationId,patch) : findApplicationById(record.applicationId);
  logActivity(record.applicationId,session.role,'Document Uploaded',record.status,updated.status,`${file.getName()} uploaded to ${folderName}.`);
  CacheService.getScriptCache().remove(`docs:${record.applicationId}`);
  return { ok:true, data:safe(updated), document:{name:file.getName(),url:file.getUrl(),type:p.type||'document'} };
}

function getDocuments(p) {
  verifySession(p.token,null,p.applicationId);
  const record = findApplicationById(p.applicationId);
  if (record.driveFolderId && !record.driveIndexedAt) indexExistingDriveFiles(record);
  const cache = CacheService.getScriptCache();
  const key = `docs:${p.applicationId}`;
  const cached = cache.get(key);
  if (cached) return { ok:true, data:JSON.parse(cached) };
  const items = scanSheetForApplication('Documents',p.applicationId,1000).map(safe);
  try { cache.put(key,JSON.stringify(items),60); } catch (_) {}
  return { ok:true, data:items };
}

function indexExistingDriveFiles(record) {
  const folder = DriveApp.getFolderById(record.driveFolderId);
  const rows = [];
  walkDrive(folder,rows,record.applicationId);
  if (rows.length) {
    const sh = sheet('Documents');
    const h = headers('Documents');
    sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows.map(item => h.map(key => item[key] ?? '')));
  }
  updateApplicationSystem(record.applicationId,{driveIndexedAt:new Date()});
}

function walkDrive(folder,out,applicationId) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    out.push({documentId:`DOC-${Utilities.getUuid()}`,applicationId,fileId:file.getId(),name:file.getName(),type:folder.getName()==='Bank Statements'?'statement':'document',mimeType:file.getMimeType(),created:file.getDateCreated(),url:file.getUrl(),folderName:folder.getName()});
  }
  const folders = folder.getFolders();
  while (folders.hasNext()) walkDrive(folders.next(),out,applicationId);
}

function scanSheetForApplication(name, applicationId, chunkSize) {
  const sh = sheet(name);
  const h = headers(name);
  const appIndex = h.indexOf('applicationId');
  let end = sh.getLastRow();
  const found = [];
  while (end >= 2) {
    const start = Math.max(2,end-chunkSize+1);
    const values = sh.getRange(start,1,end-start+1,h.length).getValues();
    for (let i=values.length-1;i>=0;i--) {
      if (String(values[i][appIndex]) === String(applicationId)) found.push(rowToObject(name,values[i]));
    }
    end = start-1;
  }
  return found;
}

function logActivity(applicationId, actor, action, fromStatus, toStatus, detail) {
  appendObject('Activity',{
    activityId:`ACT-${Utilities.getUuid()}`,created:new Date(),applicationId,actor,action,
    fromStatus:fromStatus||'',toStatus:toStatus||'',detail:detail||''
  });
  CacheService.getScriptCache().remove(`activity:${applicationId}`);
}

function getActivity(p) {
  verifySession(p.token,null,p.applicationId);
  const limit = Math.min(50,Math.max(1,Number(p.limit||20)));
  const key = `activity:${p.applicationId}`;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(key);
  if (cached) return { ok:true, data:JSON.parse(cached).slice(0,limit) };
  const sh = sheet('Activity');
  const h = headers('Activity');
  const appIndex = h.indexOf('applicationId');
  let end = sh.getLastRow();
  const items = [];
  while (end >= 2 && items.length < limit) {
    const start = Math.max(2,end-399);
    const values = sh.getRange(start,1,end-start+1,h.length).getValues();
    for (let i=values.length-1;i>=0 && items.length<limit;i--) {
      if (String(values[i][appIndex]) === String(p.applicationId)) items.push(rowToObject('Activity',values[i]));
    }
    end = start-1;
  }
  try { cache.put(key,JSON.stringify(items),30); } catch (_) {}
  return { ok:true, data:items };
}

function queueApprovalNotification(record) {
  appendObject('Notifications',{
    notificationId:`NTF-${Utilities.getUuid()}`,created:new Date(),status:'pending',applicationId:record.applicationId,
    to:record.email,template:record.status,attempts:0,lastError:'',sentAt:''
  });
}

function ensureNotificationTrigger() {
  const exists = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'processNotificationQueue');
  if (!exists) ScriptApp.newTrigger('processNotificationQueue').timeBased().everyMinutes(1).create();
}

function processNotificationQueue() {
  const sh = sheet('Notifications');
  if (sh.getLastRow() < 2) return;
  const h = headers('Notifications');
  const values = sh.getRange(2,1,sh.getLastRow()-1,h.length).getValues();
  const statusIndex = h.indexOf('status');
  const attemptsIndex = h.indexOf('attempts');
  const errorIndex = h.indexOf('lastError');
  const sentIndex = h.indexOf('sentAt');
  let processed = 0;
  for (let i=0;i<values.length && processed<20;i++) {
    if (String(values[i][statusIndex]) !== 'pending') continue;
    const item = rowToObject('Notifications',values[i]);
    try {
      const record = findApplicationById(item.applicationId);
      sendApprovalEmail(record,item.template,item.to);
      values[i][statusIndex] = 'sent';
      values[i][attemptsIndex] = Number(item.attempts||0)+1;
      values[i][errorIndex] = '';
      values[i][sentIndex] = new Date();
      updateApplicationSystem(item.applicationId,{lastNotificationStatus:item.template,lastNotificationAt:new Date(),lastNotificationError:'',lastNotificationQueuedStatus:''});
      logActivity(item.applicationId,'system','Approval Email Sent',record.status,record.status,`${item.template} alert sent to ${item.to}.`);
    } catch (err) {
      const attempts = Number(item.attempts||0)+1;
      values[i][attemptsIndex] = attempts;
      values[i][errorIndex] = err.message || String(err);
      if (attempts >= 3) values[i][statusIndex] = 'failed';
      updateApplicationSystem(item.applicationId,{lastNotificationError:err.message || String(err)});
    }
    processed++;
  }
  sh.getRange(2,1,values.length,h.length).setValues(values);
}

function sendApprovalEmail(record,status,to) {
  if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Daily email sending quota has been reached.');
  const clientName = String(record.name||'Client').trim();
  const subject = status === 'Approved' ? 'Your financing approval is ready to review' : 'A conditional approval is ready to review';
  const body = [`Hello ${clientName},`,'','There is an important update regarding your financing application with Toronto Finance Company.','','Please log in to your secure client dashboard to review the update:',CONFIG.CLIENT_PORTAL_URL,'','For your privacy, approval details are not included in this email.','',CONFIG.COMPANY_NAME].join('\n');
  const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#17130f;line-height:1.6"><div style="background:#17130f;color:#fff;padding:22px 26px"><div style="font-size:18px">${escapeHtml(CONFIG.COMPANY_NAME)}</div></div><div style="padding:28px 26px;border:1px solid #e6ddd2;border-top:0"><p>Hello ${escapeHtml(clientName)},</p><h2 style="font-weight:500">${escapeHtml(status)} Available</h2><p>There is an important update regarding your financing application.</p><p>Please log in to your secure client dashboard to review the update and next steps.</p><p style="margin:28px 0"><a href="${escapeHtml(CONFIG.CLIENT_PORTAL_URL)}" style="display:inline-block;background:#17130f;color:#fff;text-decoration:none;padding:13px 22px;border-radius:999px">Log In to Client Portal</a></p><p style="font-size:12px;color:#786f65">For your privacy, approval details are not included in this email.</p></div></div>`;
  MailApp.sendEmail(String(to||record.email),subject,body,{htmlBody,name:CONFIG.COMPANY_NAME,replyTo:CONFIG.ADMIN_EMAIL});
}

function escapeHtml(value) {
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}