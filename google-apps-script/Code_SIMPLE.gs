const CONFIG = {
  SHEET_ID: '1pRN82iNCVpU31DJQA3xUrMVkMcPRPv1Rl69WH3VRco4',
  ROOT_FOLDER_ID: '1ao4Tlk65yxtr8yHGJaNGqyKPOHYFfXjb',
  ADMIN_EMAIL: 'admin@torontofinance.ca',
  SIGNUP_NOTIFICATION_EMAIL: 'info@torontofinancecompany.com',
  ADMIN_PASSWORD: 'CHANGE_THIS_PASSWORD',
  CLIENT_PORTAL_URL: 'https://torontofinancecompany.com/client-dashboard.html',
  CLIENT_NOTIFICATION_FROM: 'info@torontofinancecompany.com',
  COMPANY_NAME: 'Toronto Finance Company',
  MIN_STATEMENTS: 6
};

const REQUIRED_HEADERS = [
  'applicationId','created','updated','name','email','passwordHash','phone','business',
  'address','city','province','postal','industry','revenue','requested','years','purpose',
  'status','statements','signatureConfirmed','signatureConfirmedAt','advisor','messageTitle','messageBody','approvedAmount','quote',
  'term','paymentFrequency','paymentAmount','numberPayments','totalRepayment','documentsRequested','additionalDocsEnabled',
  'clientDecision','clientDecisionNote','clientDecisionAt','chatHistory','notes',
  'driveFolderId','driveUrl','lastNotificationStatus','lastNotificationAt','lastNotificationError'
];

const CLIENT_SAFE_FIELDS = [
  'applicationId','created','updated','name','email','phone','business','status','statements',
  'signatureConfirmed','signatureConfirmedAt','advisor','messageTitle','messageBody','approvedAmount',
  'quote','term','paymentFrequency','paymentAmount','numberPayments','totalRepayment','documentsRequested','additionalDocsEnabled',
  'clientDecision','clientDecisionNote','clientDecisionAt','chatHistory','documents'
];

const EARLY_STATUSES = ['Account Created','Statements Required','Ready for Review'];
const APPROVAL_STATUSES = ['Conditional Approval','Approved'];
const SCHEMA_CACHE_KEY = 'tfc-schema-20261107-chat-history-v2';
const AUDIT_SHEET_NAME = 'Audit Log';
const AUDIT_HEADERS = [
  'auditId','timestamp','applicationId','actorType','actorId',
  'action','field','oldValue','newValue','summary','metadata'
];
const LENDER_SHEET_NAME = 'Lenders';
const LENDER_HEADERS = ['lenderId','created','updated','name','email','contactName','notes','active'];
const DEFAULT_LENDERS = [
  { name:'Journey Capital', email:'agentapps@journeycapital.ca' },
  { name:'Xuper Funding', email:'iso@xpfunding.com' },
  { name:'Canacap', email:'communications@canacap.ca' },
  { name:'Sheaves Capital', email:'apps@sheavescapital.ca' }
];
const DEFAULT_LENDERS_SEEDED_KEY = 'tfc-default-lenders-seeded-v1';
const ADMIN_TOKEN_TTL_SECONDS = 21600;
const MAX_LENDER_PACKAGE_BYTES = 17 * 1024 * 1024;
const DOCUMENT_INDEX_CACHE_SECONDS = 20;
const UPLOAD_IDEMPOTENCY_SECONDS = 21600;
const AUDIT_CACHE_SECONDS = 15;
const FIREBASE_TEST_BUILD = '20261109-fb-debug-v4';

function doGet(e) {
  try {
    const p = parseGet(e);
    if (!p.action || p.action === 'health') return output(health(), p.callback);

    const actions = {
      createAccount,
      clientLogin,
      createAccountFirebaseTest,
      clientLoginFirebaseTest,
      getClient,
      clientConfirmSignature,
      clientDecision,
      clientChatSend,
      adminLogin,
      adminList,
      adminUpdate,
      adminUpdateAndNotify,
      adminChatSend,
      adminEnsureDrive,
      adminGetAudit,
      adminListLenders,
      adminSaveLender,
      adminDeleteLender,
      adminGetSubmissionDocuments,
      adminSendLenderPackage,
      getDocuments,
      firebaseTestRequestStatus,
      firebaseTestHealth
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
      createAccountFirebaseTest,
      clientLoginFirebaseTest,
      getClient,
      clientConfirmSignature,
      clientDecision,
      clientChatSend,
      sendSignupNotification,
      uploadDocument,
      adminLogin,
      adminList,
      adminUpdate,
      adminUpdateAndNotify,
      adminChatSend,
      adminEnsureDrive,
      adminGetAudit,
      adminListLenders,
      adminSaveLender,
      adminDeleteLender,
      adminGetSubmissionDocuments,
      adminSendLenderPackage,
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
    service:'Toronto Finance Company CRM Simple 1.8 Lender Submissions',
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

function requireClientEmail(record, emailValue) {
  const email = String(emailValue || '').trim().toLowerCase();
  const recordEmail = String(record.email || '').trim().toLowerCase();
  if (!email || email !== recordEmail) throw new Error('Account verification failed');
  return email;
}

function parseChatHistory(value) {
  if (Array.isArray(value)) return value;
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function appendChatMessageResult(applicationId, sender, message, messageId) {
  const text = String(message || '').trim().slice(0,4000);
  if (!text) return { record:findApplication(applicationId), deduplicated:true };

  const requestedId = String(messageId || '').trim().slice(0,120);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const record = findApplication(applicationId);
    const history = parseChatHistory(record.chatHistory);

    if (requestedId && history.some(entry => String(entry && entry.id || '') === requestedId)) {
      return { record, deduplicated:true };
    }

    history.push({
      id:requestedId || Utilities.getUuid(),
      sender:String(sender || '').toUpperCase() === 'CLIENT' ? 'CLIENT' : 'ADVISOR',
      message:text,
      at:new Date().toISOString()
    });

    while (history.length > 60) history.shift();
    let serialized = JSON.stringify(history);
    while (serialized.length > 45000 && history.length > 1) {
      history.shift();
      serialized = JSON.stringify(history);
    }

    updateRecordUnlocked(applicationId,{ chatHistory:serialized });
    return { record:findApplication(applicationId), deduplicated:false };
  } finally {
    lock.releaseLock();
  }
}

function appendChatMessage(applicationId, sender, message, messageId) {
  return appendChatMessageResult(applicationId,sender,message,messageId).record;
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

function updateRecordUnlocked(applicationId, patch) {
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

function updateRecord(applicationId, patch) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return updateRecordUnlocked(applicationId,patch);
  } finally {
    lock.releaseLock();
  }
}

function auditSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sh = ss.getSheetByName(AUDIT_SHEET_NAME);

  if (!sh) {
    sh = ss.insertSheet(AUDIT_SHEET_NAME);
    ensureColumnCapacity(sh,AUDIT_HEADERS.length);
    sh.getRange(1,1,1,AUDIT_HEADERS.length).setValues([AUDIT_HEADERS]);
    return sh;
  }

  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    ensureColumnCapacity(sh,AUDIT_HEADERS.length);
    sh.getRange(1,1,1,AUDIT_HEADERS.length).setValues([AUDIT_HEADERS]);
    return sh;
  }

  const width = Math.max(1,sh.getLastColumn());
  const headers = sh.getRange(1,1,1,width).getValues()[0]
    .map(value => String(value || '').trim());
  const merged = headers.slice();
  AUDIT_HEADERS.forEach(header => {
    if (!merged.includes(header)) merged.push(header);
  });
  ensureColumnCapacity(sh,merged.length);
  if (merged.length !== width) sh.getRange(1,1,1,merged.length).setValues([merged]);
  return sh;
}

function auditValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    try { return JSON.stringify(value).slice(0,10000); } catch (_) {}
  }
  return String(value).slice(0,10000);
}

function auditCacheKey(applicationId) {
  return 'tfc-audit-' + hash(String(applicationId || '')).slice(0,40);
}

function appendAuditEvent(event) {
  try {
    const sh = auditSheet();
    const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]
      .map(value => String(value || '').trim());
    const record = {
      auditId:'AUD-' + Utilities.getUuid(),
      timestamp:new Date(),
      applicationId:String(event.applicationId || ''),
      actorType:String(event.actorType || 'SYSTEM').toUpperCase(),
      actorId:String(event.actorId || ''),
      action:String(event.action || 'UPDATE').toUpperCase(),
      field:String(event.field || ''),
      oldValue:auditValue(event.oldValue),
      newValue:auditValue(event.newValue),
      summary:String(event.summary || ''),
      metadata:auditValue(event.metadata || '')
    };
    const row = headers.map(header => Object.prototype.hasOwnProperty.call(record,header) ? record[header] : '');
    sh.appendRow(row);
    if (record.applicationId) {
      CacheService.getScriptCache().remove(auditCacheKey(record.applicationId));
    }
  } catch (error) {
    Logger.log('Audit event could not be written: ' + (error && error.message ? error.message : error));
  }
}

function auditFieldLabel(field) {
  const labels = {
    business:'Business name',
    status:'Status',
    advisor:'Assigned advisor',
    messageTitle:'Client message title',
    messageBody:'Client message',
    approvedAmount:'Approved amount',
    quote:'Product / terms',
    term:'Term',
    paymentFrequency:'Payment frequency',
    paymentAmount:'Payment amount',
    numberPayments:'Number of payments',
    totalRepayment:'Total repayment',
    documentsRequested:'Additional documents requested',
    additionalDocsEnabled:'Additional document upload',
    notes:'Internal / advisor notes'
  };
  return labels[field] || field;
}

function auditAdminChange(applicationId,field,oldValue,newValue) {
  const oldText = auditValue(oldValue);
  const newText = auditValue(newValue);
  if (oldText === newText) return;

  let action = 'ADMIN_FIELD_UPDATED';
  if (field === 'business') action = 'BUSINESS_NAME_UPDATED';
  else if (field === 'status') action = 'STATUS_CHANGED';
  else if (['approvedAmount','quote','term','paymentFrequency','paymentAmount','numberPayments','totalRepayment'].includes(field)) action = 'FINANCING_UPDATED';
  else if (field === 'documentsRequested') action = 'DOCUMENTS_REQUESTED';
  else if (field === 'additionalDocsEnabled') action = 'ADDITIONAL_DOCS_VISIBILITY_CHANGED';
  else if (['messageTitle','messageBody'].includes(field)) action = 'CLIENT_MESSAGE_UPDATED';
  else if (field === 'advisor') action = 'ADVISOR_UPDATED';
  else if (field === 'notes') action = 'INTERNAL_NOTES_UPDATED';

  const label = auditFieldLabel(field);
  const summary = field === 'status'
    ? 'Status changed from ' + (oldText || 'Not set') + ' to ' + (newText || 'Not set')
    : label + ' updated';

  const redactHistory = ['notes','messageBody'].includes(field);
  appendAuditEvent({
    applicationId,
    actorType:'ADMIN',
    actorId:CONFIG.ADMIN_EMAIL,
    action,
    field,
    oldValue:redactHistory ? '' : oldText,
    newValue:redactHistory ? '' : newText,
    summary
  });
}

function adminGetAudit(p) {
  requireAdminToken(p);
  const applicationId = String(p.applicationId || '').trim();
  if (!applicationId) throw new Error('Application ID is required');
  findApplication(applicationId);

  const cache = CacheService.getScriptCache();
  const cacheKey = auditCacheKey(applicationId);
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return { ok:true, data:parsed, cached:true };
    } catch (_) {}
  }

  const sh = auditSheet();
  if (sh.getLastRow() < 2) return { ok:true, data:[] };

  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]
    .map(value => String(value || '').trim());
  const values = sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues();

  const data = values
    .map(row => rowToObject(headers,row))
    .filter(record => String(record.applicationId || '') === applicationId)
    .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0,250);

  try {
    cache.put(cacheKey,JSON.stringify(data),AUDIT_CACHE_SECONDS);
  } catch (_) {}

  return { ok:true, data };
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
      signatureConfirmed:false,
      signatureConfirmedAt:'',
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
      chatHistory:JSON.stringify([{
        id:Utilities.getUuid(),
        sender:'ADVISOR',
        message:'Your account has been created. Please complete your application and upload six recent bank statements.',
        at:now.toISOString()
      }]),
      notes:'',
      driveFolderId:'',
      driveUrl:'',
      lastNotificationStatus:'',
      lastNotificationAt:'',
      lastNotificationError:''
    };

    appendRecordToSheet(sh,headers,record);
    appendAuditEvent({
      applicationId:record.applicationId,
      actorType:'CLIENT',
      actorId:record.email,
      action:'ACCOUNT_CREATED',
      summary:'Client account created',
      metadata:{ name:record.name, business:record.business || '' }
    });
    return { ok:true, data:safeClient({ ...record, documents:[] }) };
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

  appendAuditEvent({
    applicationId:record.applicationId,
    actorType:'CLIENT',
    actorId:record.email,
    action:'CLIENT_LOGIN',
    summary:'Client signed in to the portal'
  });

  return { ok:true, data:safeClient({ ...record, documents:[] }) };
}


/**
 * Firebase authentication test bridge.
 *
 * TEST ONLY:
 * - The live Apply and Client Login pages do not call these actions.
 * - Uses the existing Applications sheet and existing notification/email logic.
 * - Firebase UID mapping is kept in Script Properties, not in a new sheet/tab.
 * - Test applications use a TFC-FB-* ID so they cannot affect live TFC-###### numbering.
 */
const FIREBASE_TEST_API_KEY = 'AIzaSyAXIObBDa-i8W_wAUtt43FXracH7ezPhlA';
const FIREBASE_TEST_REQUEST_TTL_SECONDS = 300;
const FIREBASE_TEST_MAPPING_PREFIX = 'tfc-firebase-test-map-';

function firebaseTestHealth() {
  let applicationsReady = false;
  let sheetName = '';
  try {
    const sh = applicationsSheet();
    applicationsReady = Boolean(sh);
    sheetName = sh ? sh.getName() : '';
  } catch (_) {}

  return {
    ok:true,
    testOnly:true,
    build:FIREBASE_TEST_BUILD,
    firebaseProject:'toronto-finance-company-auth',
    applicationsReady,
    sheetName,
    postActionsReady:true
  };
}

function firebaseTestRequestCacheKey(requestId) {
  const id = String(requestId || '').trim();
  if (!/^[a-zA-Z0-9_-]{20,120}$/.test(id)) throw new Error('Invalid Firebase test request ID');
  return 'tfc-firebase-test-request-' + id;
}

function cacheFirebaseTestResult(requestId,result) {
  if (!requestId) return;
  try {
    CacheService.getScriptCache().put(
      firebaseTestRequestCacheKey(requestId),
      JSON.stringify(result),
      FIREBASE_TEST_REQUEST_TTL_SECONDS
    );
  } catch (_) {}
}

function firebaseTestRequestStatus(p) {
  const raw = CacheService.getScriptCache().get(firebaseTestRequestCacheKey(p.requestId));
  if (!raw) return { ok:true, pending:true };

  try {
    return { ok:true, pending:false, result:JSON.parse(raw) };
  } catch (_) {
    return { ok:false, pending:false, error:'Firebase test request result could not be read' };
  }
}

function firebaseTestVerifyIdToken(idToken, requireVerified) {
  const token = String(idToken || '').trim();
  if (token.length < 100 || token.length > 10000) {
    throw new Error('Firebase session token is missing or invalid');
  }

  const response = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(FIREBASE_TEST_API_KEY),
    {
      method:'post',
      contentType:'application/json',
      payload:JSON.stringify({ idToken:token }),
      muteHttpExceptions:true
    }
  );

  let body = {};
  try { body = JSON.parse(response.getContentText() || '{}'); } catch (_) {}

  if (response.getResponseCode() !== 200 || !body.users || !body.users[0]) {
    const firebaseMessage = String(body && body.error && body.error.message || '').trim();
    throw new Error(
      'Firebase session could not be verified' +
      (firebaseMessage ? ' (' + firebaseMessage + ')' : ' (HTTP ' + response.getResponseCode() + ')')
    );
  }

  const user = body.users[0];
  const uid = String(user.localId || '').trim();
  const email = String(user.email || '').trim().toLowerCase();
  const providers = (user.providerUserInfo || [])
    .map(item => String(item.providerId || '').trim())
    .filter(Boolean);

  if (!uid || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Firebase account is missing a valid email address');
  }
  const emailVerified = user.emailVerified === true;
  if (requireVerified !== false && !emailVerified) {
    throw new Error('Please verify your email address before continuing');
  }

  return {
    uid,
    email,
    emailVerified,
    provider:providers.includes('google.com') ? 'google.com' : (providers[0] || 'firebase')
  };
}

function firebaseTestMappingKey(uid) {
  return FIREBASE_TEST_MAPPING_PREFIX + String(uid || '').trim();
}

function firebaseTestGetMapping(uid) {
  const raw = PropertiesService.getScriptProperties().getProperty(firebaseTestMappingKey(uid));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    throw new Error('Firebase test mapping could not be read');
  }
}

function firebaseTestSaveMapping(firebase,applicationId) {
  PropertiesService.getScriptProperties().setProperty(
    firebaseTestMappingKey(firebase.uid),
    JSON.stringify({
      firebaseUid:firebase.uid,
      email:firebase.email,
      provider:firebase.provider,
      applicationId:String(applicationId || ''),
      updated:new Date().toISOString()
    })
  );
}

function firebaseTestApplicationId(firebaseUid) {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Vancouver', 'yyyyMMdd-HHmmss');
  const suffix = String(firebaseUid || '').replace(/[^a-zA-Z0-9]/g,'').slice(-6).toUpperCase() || 'TEST';
  let candidate = 'TFC-FB-' + stamp + '-' + suffix;
  let counter = 1;

  while (findRow('applicationId',candidate)) {
    counter += 1;
    candidate = 'TFC-FB-' + stamp + '-' + suffix + '-' + counter;
  }
  return candidate;
}

function createAccountFirebaseTest(p) {
  const requestId = String(p.requestId || '').trim();
  let result;

  try {
    const firebase = firebaseTestVerifyIdToken(p.firebaseIdToken,false);
    const name = String(p.name || '').trim();
    const phone = String(p.phone || '').trim();

    if (!name) throw new Error('Name is required');
    if (phone.replace(/\D/g,'').length < 7) throw new Error('A valid phone number is required');

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);

    let record;
    let deduplicated = false;

    try {
      const mapped = firebaseTestGetMapping(firebase.uid);

      if (mapped) {
        if (String(mapped.email || '').trim().toLowerCase() !== firebase.email) {
          throw new Error('Firebase test mapping email mismatch');
        }

        record = findApplication(mapped.applicationId);
        if (String(record.email || '').trim().toLowerCase() !== firebase.email) {
          throw new Error('Applications sheet email does not match the Firebase test account');
        }
        deduplicated = true;
      } else {
        if (findRow('email',firebase.email)) {
          throw new Error('This email already exists in the Applications sheet. Use a new test email so no existing client is changed.');
        }

        const now = new Date();
        record = {
          applicationId:firebaseTestApplicationId(firebase.uid),
          created:now,
          updated:now,
          name,
          email:firebase.email,
          passwordHash:'',
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
          signatureConfirmed:false,
          signatureConfirmedAt:'',
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
          chatHistory:JSON.stringify([{
            id:Utilities.getUuid(),
            sender:'ADVISOR',
            message:'Your account has been created. Please complete your application and upload six recent bank statements.',
            at:now.toISOString()
          }]),
          notes:'FIREBASE AUTH TEST ONLY — do not treat as a production client.',
          driveFolderId:'',
          driveUrl:'',
          lastNotificationStatus:'',
          lastNotificationAt:'',
          lastNotificationError:''
        };

        const sh = applicationsSheet();
        const headers = getHeaders(sh);
        appendRecordToSheet(sh,headers,record);
        firebaseTestSaveMapping(firebase,record.applicationId);

        appendAuditEvent({
          applicationId:record.applicationId,
          actorType:'CLIENT',
          actorId:record.email,
          action:'ACCOUNT_CREATED',
          summary:'Firebase test client account created',
          metadata:{ testOnly:true, authProvider:firebase.provider }
        });
      }
    } finally {
      lock.releaseLock();
    }

    const notification = deduplicated
      ? { ok:true, sent:true, alreadySent:true }
      : sendSignupNotification({
          applicationId:record.applicationId,
          email:record.email
        });

    result = {
      ok:true,
      testOnly:true,
      data:safeClient({ ...record, documents:[] }),
      firebase:{ provider:firebase.provider, email:firebase.email, emailVerified:firebase.emailVerified },
      notification,
      deduplicated
    };
  } catch (err) {
    result = { ok:false, testOnly:true, error:err.message || String(err) };
  }

  cacheFirebaseTestResult(requestId,result);
  return result;
}

function clientLoginFirebaseTest(p) {
  const requestId = String(p.requestId || '').trim();
  let result;

  try {
    const firebase = firebaseTestVerifyIdToken(p.firebaseIdToken,true);
    const mapped = firebaseTestGetMapping(firebase.uid);

    if (!mapped) {
      throw new Error('No Firebase test application is linked to this account yet');
    }
    if (String(mapped.email || '').trim().toLowerCase() !== firebase.email) {
      throw new Error('Firebase test account verification failed');
    }

    const record = findApplication(mapped.applicationId);
    if (String(record.email || '').trim().toLowerCase() !== firebase.email) {
      throw new Error('Applications sheet email does not match Firebase');
    }

    appendAuditEvent({
      applicationId:record.applicationId,
      actorType:'CLIENT',
      actorId:record.email,
      action:'CLIENT_LOGIN',
      summary:'Client signed in through Firebase test authentication',
      metadata:{ testOnly:true, authProvider:firebase.provider }
    });

    result = {
      ok:true,
      testOnly:true,
      data:safeClient({ ...record, documents:[] }),
      firebase:{ provider:firebase.provider, email:firebase.email, emailVerified:firebase.emailVerified }
    };
  } catch (err) {
    result = { ok:false, testOnly:true, error:err.message || String(err) };
  }

  cacheFirebaseTestResult(requestId,result);
  return result;
}

function getClient(p) {
  const record = findApplication(p.applicationId);
  requireClientEmail(record,p.email);
  return { ok:true, data:safeClient({ ...record, documents:[] }) };
}

function clientConfirmSignature(p) {
  const record = findApplication(p.applicationId);
  const clientEmail = requireClientEmail(record,p.email);
  const alreadyConfirmed = record.signatureConfirmed === true ||
    ['true','1','yes'].includes(String(record.signatureConfirmed || '').toLowerCase());

  updateRecord(record.applicationId,{
    signatureConfirmed:true,
    signatureConfirmedAt:record.signatureConfirmedAt || new Date()
  });

  if (!alreadyConfirmed) {
    appendAuditEvent({
      applicationId:record.applicationId,
      actorType:'CLIENT',
      actorId:clientEmail,
      action:'SIGNATURE_CONFIRMED',
      field:'signatureConfirmed',
      oldValue:false,
      newValue:true,
      summary:'Client confirmed the signing step'
    });
  }

  const fresh = findApplication(record.applicationId);
  return { ok:true, data:safeClient({ ...fresh, documents:[] }) };
}

function clientDecision(p) {
  const record = findApplication(p.applicationId);
  requireClientEmail(record,p.email);

  const decision = String(p.decision || '').trim();
  if (!['Proceed','Request More Information'].includes(decision)) {
    throw new Error('Please choose Proceed or Request More Information');
  }

  const note = String(p.note || '').trim();
  const sameDecision =
    String(record.clientDecision || '') === decision &&
    String(record.clientDecisionNote || '') === note;

  if (sameDecision) {
    return { ok:true, data:safeClient({ ...record, documents:[] }), deduplicated:true };
  }

  updateRecord(record.applicationId,{
    clientDecision:decision,
    clientDecisionNote:note,
    clientDecisionAt:new Date()
  });

  const fresh = findApplication(record.applicationId);
  appendAuditEvent({
    applicationId:record.applicationId,
    actorType:'CLIENT',
    actorId:String(record.email || ''),
    action:'CLIENT_DECISION',
    field:'clientDecision',
    oldValue:record.clientDecision || '',
    newValue:decision,
    summary:'Client response: ' + decision
  });
  if (decision === 'Request More Information' && note) {
    appendChatMessage(record.applicationId,'CLIENT',note,p.messageId);
  }
  const withChat = findApplication(record.applicationId);
  sendClientDecisionEmail(withChat);
  return { ok:true, data:safeClient({ ...withChat, documents:[] }) };
}

function clientChatSend(p) {
  const record = findApplication(p.applicationId);
  const clientEmail = requireClientEmail(record,p.email);
  const message = String(p.message || '').trim();
  if (!message) throw new Error('Message is required');

  const chatResult = appendChatMessageResult(record.applicationId,'CLIENT',message,p.messageId);
  const fresh = chatResult.record;

  if (!chatResult.deduplicated) {
    appendAuditEvent({
      applicationId:record.applicationId,
      actorType:'CLIENT',
      actorId:clientEmail,
      action:'CLIENT_CHAT_MESSAGE',
      field:'chatHistory',
      summary:'Client sent a portal message',
      metadata:{ length:message.length }
    });
  }

  return {
    ok:true,
    data:safeClient({ ...fresh, documents:[] }),
    deduplicated:chatResult.deduplicated
  };
}

function sendSignupNotification(p) {
  const record = findApplication(p.applicationId);
  requireClientEmail(record,p.email);

  const cache = CacheService.getScriptCache();
  const cacheKey = `signup-notified-${record.applicationId}`;
  if (cache.get(cacheKey) === '1') {
    return { ok:true, sent:true, alreadySent:true };
  }

  const result = sendNewClientSignupEmail(record);
  if (result.sent) {
    cache.put(cacheKey,'1',21600);
    appendAuditEvent({
      applicationId:record.applicationId,
      actorType:'SYSTEM',
      actorId:CONFIG.SIGNUP_NOTIFICATION_EMAIL,
      action:'SIGNUP_NOTIFICATION_SENT',
      summary:'New-client signup notification sent'
    });
    return { ok:true, ...result };
  }

  return { ok:false, ...result };
}


function adminLogin(p) {
  if (CONFIG.ADMIN_PASSWORD === 'CHANGE_THIS_PASSWORD') {
    throw new Error('Change ADMIN_PASSWORD in the deployed Apps Script before using admin login.');
  }

  const email = String(p.email || '').trim().toLowerCase();
  const password = String(p.password || '');

  if (email !== CONFIG.ADMIN_EMAIL.toLowerCase() || password !== CONFIG.ADMIN_PASSWORD) {
    throw new Error('Invalid admin credentials');
  }

  const adminToken = Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put('tfc-admin-token-' + adminToken,email,ADMIN_TOKEN_TTL_SECONDS);
  return { ok:true, adminToken };
}

function requireAdminToken(p) {
  const token = String((p && p.adminToken) || '').trim();
  if (!token) throw new Error('Admin session expired. Please log out and log back in.');

  const email = CacheService.getScriptCache().get('tfc-admin-token-' + token);
  if (!email || String(email).toLowerCase() !== String(CONFIG.ADMIN_EMAIL).toLowerCase()) {
    throw new Error('Admin session expired. Please log out and log back in.');
  }
  return email;
}

function lendersSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sh = ss.getSheetByName(LENDER_SHEET_NAME);

  if (!sh) {
    sh = ss.insertSheet(LENDER_SHEET_NAME);
    ensureColumnCapacity(sh,LENDER_HEADERS.length);
    sh.getRange(1,1,1,LENDER_HEADERS.length).setValues([LENDER_HEADERS]);
    return sh;
  }

  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    ensureColumnCapacity(sh,LENDER_HEADERS.length);
    sh.getRange(1,1,1,LENDER_HEADERS.length).setValues([LENDER_HEADERS]);
    return sh;
  }

  const width = Math.max(1,sh.getLastColumn());
  const headers = sh.getRange(1,1,1,width).getValues()[0].map(value => String(value || '').trim());
  const merged = headers.slice();
  LENDER_HEADERS.forEach(header => {
    if (!merged.includes(header)) merged.push(header);
  });
  ensureColumnCapacity(sh,merged.length);
  if (merged.length !== width) sh.getRange(1,1,1,merged.length).setValues([merged]);
  return sh;
}

function lenderIsActive(value) {
  return value === true || ['true','1','yes'].includes(String(value || '').trim().toLowerCase());
}

function seedDefaultLenders(sh) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(DEFAULT_LENDERS_SEEDED_KEY) === '1') return;

  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]
    .map(value => String(value || '').trim());
  let existingEmails = [];

  if (sh.getLastRow() >= 2) {
    existingEmails = sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues()
      .map(row => rowToObject(headers,row))
      .map(record => String(record.email || '').trim().toLowerCase())
      .filter(Boolean);
  }

  DEFAULT_LENDERS.forEach(lender => {
    if (existingEmails.includes(lender.email.toLowerCase())) return;
    const now = new Date();
    appendRecordToSheet(sh,headers,{
      lenderId:'LND-' + Utilities.getUuid().replace(/-/g,'').slice(0,10).toUpperCase(),
      created:now,
      updated:now,
      name:lender.name,
      email:lender.email,
      contactName:'',
      notes:'',
      active:true
    });
  });

  props.setProperty(DEFAULT_LENDERS_SEEDED_KEY,'1');
}

function allLenders() {
  const sh = lendersSheet();
  seedDefaultLenders(sh);
  if (sh.getLastRow() < 2) return [];
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(value => String(value || '').trim());
  return sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues()
    .map(row => rowToObject(headers,row))
    .filter(record => record.lenderId && lenderIsActive(record.active))
    .sort((a,b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function findLenderRow(lenderId) {
  const sh = lendersSheet();
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(value => String(value || '').trim());
  return findRowInSheet(sh,headers,'lenderId',String(lenderId || ''));
}

function saveLenderRecord(lenderId,patch) {
  const found = findLenderRow(lenderId);
  if (!found) throw new Error('Lender not found');
  const row = found.sh.getRange(found.rowNumber,1,1,found.headers.length).getValues()[0];
  found.headers.forEach((header,index) => {
    if (Object.prototype.hasOwnProperty.call(patch,header)) row[index] = patch[header];
  });
  const updatedIndex = found.headers.indexOf('updated');
  if (updatedIndex >= 0) row[updatedIndex] = new Date();
  found.sh.getRange(found.rowNumber,1,1,found.headers.length).setValues([row]);
}

function adminListLenders(p) {
  requireAdminToken(p);
  return {
    ok:true,
    data:allLenders().map(lender => ({
      lenderId:String(lender.lenderId || ''),
      name:String(lender.name || ''),
      email:String(lender.email || ''),
      contactName:String(lender.contactName || ''),
      notes:String(lender.notes || '')
    }))
  };
}

function adminSaveLender(p) {
  requireAdminToken(p);

  const name = String(p.name || '').trim();
  const email = String(p.email || '').trim().toLowerCase();
  const contactName = String(p.contactName || '').trim();
  const notes = String(p.notes || '').trim();
  const lenderId = String(p.lenderId || '').trim();

  if (!name) throw new Error('Lender name is required');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('A valid lender email is required');

  const duplicate = allLenders().find(lender =>
    String(lender.email || '').trim().toLowerCase() === email &&
    String(lender.lenderId || '') !== lenderId
  );
  if (duplicate) throw new Error('A lender with this email already exists');

  if (lenderId) {
    saveLenderRecord(lenderId,{ name,email,contactName,notes,active:true });
    return { ok:true, lenderId };
  }

  const sh = lendersSheet();
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(value => String(value || '').trim());
  const now = new Date();
  const record = {
    lenderId:'LND-' + Utilities.getUuid().replace(/-/g,'').slice(0,10).toUpperCase(),
    created:now,
    updated:now,
    name,
    email,
    contactName,
    notes,
    active:true
  };
  appendRecordToSheet(sh,headers,record);
  return { ok:true, lenderId:record.lenderId };
}

function adminDeleteLender(p) {
  requireAdminToken(p);
  const lenderId = String(p.lenderId || '').trim();
  if (!lenderId) throw new Error('Lender is required');
  saveLenderRecord(lenderId,{ active:false });
  return { ok:true };
}

function adminList(p) {
  requireAdminToken(p);
  return {
    ok:true,
    data:allRows().map(record => safe({ ...record, documents:[] }))
  };
}

function adminUpdate(p) {
  requireAdminToken(p);
  const before = findApplication(p.applicationId);
  const patch = {};

  ['business','status','advisor','messageTitle','messageBody','approvedAmount','quote','term','paymentFrequency',
   'paymentAmount','numberPayments','totalRepayment','documentsRequested','additionalDocsEnabled','notes']
    .forEach(key => {
      if (Object.prototype.hasOwnProperty.call(p,key)) patch[key] = p[key];
    });

  updateRecord(p.applicationId,patch);
  let saved = findApplication(p.applicationId);

  const messageWasUpdated =
    (Object.prototype.hasOwnProperty.call(patch,'messageBody') && String(patch.messageBody || '').trim() !== String(before.messageBody || '').trim()) ||
    (Object.prototype.hasOwnProperty.call(patch,'messageTitle') && String(patch.messageTitle || '').trim() !== String(before.messageTitle || '').trim());

  if (messageWasUpdated) {
    const advisorMessage = String(patch.messageBody || saved.messageBody || patch.messageTitle || saved.messageTitle || '').trim();
    if (advisorMessage) saved = appendChatMessage(p.applicationId,'ADVISOR',advisorMessage,p.messageId);
  }

  Object.keys(patch).forEach(field => {
    auditAdminChange(p.applicationId,field,before[field],saved[field]);
  });

  let notification = { attempted:false, sent:false };
  const shouldNotify = ['true','1','yes'].includes(String(p.notifyClient || '').toLowerCase());

  if (shouldNotify) {
    const messageFieldsProvided =
      Object.prototype.hasOwnProperty.call(patch,'messageBody') ||
      Object.prototype.hasOwnProperty.call(patch,'messageTitle');

    if (messageFieldsProvided && !messageWasUpdated) {
      notification = { attempted:false, sent:true, deduplicated:true };
    } else {
      notification = sendClientUpdateEmail(saved);
      appendAuditEvent({
        applicationId:p.applicationId,
        actorType:'ADMIN',
        actorId:CONFIG.ADMIN_EMAIL,
        action:notification.sent ? 'CLIENT_NOTIFICATION_SENT' : 'CLIENT_NOTIFICATION_FAILED',
        summary:notification.sent
          ? 'Client update notification sent'
          : 'Client update notification could not be sent',
        metadata:notification.sent
          ? { sender:notification.sender || CONFIG.CLIENT_NOTIFICATION_FROM }
          : { error:notification.error || 'Unknown notification error' }
      });
      saved = findApplication(p.applicationId);
    }
  }

  return { ok:true, data:safe(saved), notification };
}


function adminUpdateAndNotify(p) {
  requireAdminToken(p);

  // Save through the same existing update path, but keep notification explicit.
  const saveResult = adminUpdate({ ...p, notifyClient:'false' });
  if (!saveResult || !saveResult.ok) {
    throw new Error((saveResult && saveResult.error) || 'The client update could not be saved.');
  }

  const saved = findApplication(p.applicationId);
  const notification = sendClientUpdateEmail(saved);

  appendAuditEvent({
    applicationId:p.applicationId,
    actorType:'ADMIN',
    actorId:CONFIG.ADMIN_EMAIL,
    action:notification.sent ? 'CLIENT_NOTIFICATION_SENT' : 'CLIENT_NOTIFICATION_FAILED',
    summary:notification.sent
      ? 'Client update saved and email notification sent'
      : 'Client update saved but email notification could not be sent',
    metadata:notification.sent
      ? { sender:notification.sender || CONFIG.CLIENT_NOTIFICATION_FROM }
      : { error:notification.error || 'Unknown notification error' }
  });

  const refreshed = findApplication(p.applicationId);

  return {
    ok:true,
    data:safe(refreshed),
    notification:{
      ...notification,
      attempted:true
    }
  };
}

function adminChatSend(p) {
  const adminEmail = requireAdminToken(p);
  const record = findApplication(p.applicationId);
  const message = String(p.message || '').trim().slice(0,4000);
  if (!message) throw new Error('Message is required');

  updateRecord(record.applicationId,{ messageBody:message });
  const chatResult = appendChatMessageResult(record.applicationId,'ADVISOR',message,p.messageId);
  const saved = chatResult.record;

  if (chatResult.deduplicated) {
    return {
      ok:true,
      data:safe(findApplication(record.applicationId)),
      notification:{ attempted:false, sent:true, deduplicated:true },
      deduplicated:true
    };
  }

  appendAuditEvent({
    applicationId:record.applicationId,
    actorType:'ADMIN',
    actorId:adminEmail,
    action:'ADMIN_CHAT_MESSAGE',
    field:'chatHistory',
    summary:'Advisor sent a portal message',
    metadata:{ length:message.length }
  });

  const notification = sendClientUpdateEmail(saved);

  appendAuditEvent({
    applicationId:record.applicationId,
    actorType:'ADMIN',
    actorId:adminEmail,
    action:notification.sent ? 'CLIENT_NOTIFICATION_SENT' : 'CLIENT_NOTIFICATION_FAILED',
    summary:notification.sent
      ? 'Client message saved and email notification sent'
      : 'Client message saved but email notification could not be sent',
    metadata:notification.sent
      ? { sender:notification.sender || CONFIG.CLIENT_NOTIFICATION_FROM }
      : { error:notification.error || 'Unknown notification error' }
  });

  return {
    ok:true,
    data:safe(findApplication(record.applicationId)),
    notification
  };
}
function adminEnsureDrive(p) {
  requireAdminToken(p);
  const record = findApplication(p.applicationId);
  const hadFolder = Boolean(record.driveFolderId);
  const folder = ensureDriveFolder(record);
  const fresh = findApplication(p.applicationId);

  if (!hadFolder && fresh.driveFolderId) {
    appendAuditEvent({
      applicationId:p.applicationId,
      actorType:'ADMIN',
      actorId:CONFIG.ADMIN_EMAIL,
      action:'DRIVE_FOLDER_CREATED',
      summary:'Client Drive folder created'
    });
  }

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
  requireClientEmail(record,p.email);
  const type = String(p.type || '').trim().toLowerCase();
  const rootFolder = ensureDriveFolder(record);
  let folderName = 'Other Documents';
  if (type === 'statement') folderName = 'Bank Statements';
  else if (type === 'identification') folderName = 'Identification';
  else if (type === 'financial') folderName = 'Financial Statements';
  const targetFolder = childFolder(rootFolder,folderName);

  const base64 = String(p.base64 || '').trim();
  if (!base64) throw new Error('Missing document data');

  const fileName = String(p.fileName || 'document.pdf').trim() || 'document.pdf';
  const mimeType = String(p.mimeType || 'application/pdf').trim() || 'application/pdf';

  if (type === 'statement' && mimeType !== 'application/pdf' && !/\.pdf$/i.test(fileName)) {
    throw new Error('Bank statements must be uploaded as PDF files');
  }

  const estimatedBytes = Math.ceil(base64.length * 3 / 4);
  if (estimatedBytes > 20 * 1024 * 1024) {
    throw new Error('This file is too large. Please upload files smaller than 20 MB each.');
  }

  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64),
    mimeType,
    fileName
  );

  const uploadKey = String(p.uploadKey || '').trim().slice(0,500);
  const uploadCacheKey = uploadKey
    ? 'tfc-upload-' + hash(record.applicationId + '|' + uploadKey).slice(0,48)
    : '';
  const uploadCache = CacheService.getScriptCache();

  if (uploadCacheKey) {
    const uploadLock = LockService.getScriptLock();
    uploadLock.waitLock(20000);
    try {
      if (uploadCache.get(uploadCacheKey)) {
        return { ok:true, deduplicated:true };
      }
      uploadCache.put(uploadCacheKey,'processing',600);
    } finally {
      uploadLock.releaseLock();
    }
  }

  try {
    targetFolder.createFile(blob);
    if (uploadCacheKey) uploadCache.put(uploadCacheKey,'done',UPLOAD_IDEMPOTENCY_SECONDS);
    clearDocumentIndexCache(record.applicationId);
  } catch (error) {
    if (uploadCacheKey) uploadCache.remove(uploadCacheKey);
    throw error;
  }

  appendAuditEvent({
    applicationId:record.applicationId,
    actorType:'CLIENT',
    actorId:String(record.email || ''),
    action:'DOCUMENT_UPLOADED',
    field:'documents',
    newValue:fileName,
    summary:'Client uploaded ' + fileName,
    metadata:{ type:type || 'document', mimeType, estimatedBytes }
  });

  if (type === 'statement') {
    const count = countFiles(childFolder(rootFolder,'Bank Statements'));
    const patch = { statements:count };
    const currentStatus = String(record.status || 'Account Created');

    if (EARLY_STATUSES.includes(currentStatus)) {
      patch.status = count >= CONFIG.MIN_STATEMENTS ? 'Ready for Review' : 'Statements Required';
      patch.messageTitle = count >= CONFIG.MIN_STATEMENTS ? 'Documents Received' : 'Statements Required';
      patch.messageBody = count >= CONFIG.MIN_STATEMENTS
        ? 'Thank you. Your statements have been received and your file is ready for review.'
        : `Please upload ${Math.max(0,CONFIG.MIN_STATEMENTS-count)} more monthly statement(s).`;
    }

    updateRecord(record.applicationId,patch);

    if (patch.status && String(patch.status) !== String(record.status || '')) {
      appendAuditEvent({
        applicationId:record.applicationId,
        actorType:'SYSTEM',
        actorId:'CRM',
        action:'STATUS_CHANGED',
        field:'status',
        oldValue:record.status || '',
        newValue:patch.status,
        summary:'Status automatically changed from ' + (record.status || 'Not set') + ' to ' + patch.status,
        metadata:{ statementCount:count }
      });
    }
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

    updateRecordUnlocked(fresh.applicationId,{
      driveFolderId:folder.getId(),
      driveUrl:folder.getUrl()
    });
    clearDocumentIndexCache(fresh.applicationId);

    return folder;
  } finally {
    lock.releaseLock();
  }
}

function getDocuments(p) {
  requireAdminToken(p);
  return { ok:true, data:listDocuments(findApplication(p.applicationId)) };
}

function adminGetSubmissionDocuments(p) {
  requireAdminToken(p);
  const record = findApplication(p.applicationId);
  return { ok:true, data:listSubmissionDocuments(record) };
}

function documentIndexCacheKey(applicationId) {
  return 'tfc-doc-index-' + hash(String(applicationId || '')).slice(0,40);
}

function clearDocumentIndexCache(applicationId) {
  if (!applicationId) return;
  CacheService.getScriptCache().remove(documentIndexCacheKey(applicationId));
}

function listSubmissionDocuments(record) {
  if (!record.driveFolderId) return [];

  const cache = CacheService.getScriptCache();
  const cacheKey = documentIndexCacheKey(record.applicationId);
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }

  const out = [];
  try {
    walkSubmissionFolder(DriveApp.getFolderById(record.driveFolderId),out);
  } catch (_) {}

  const sorted = out.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  try {
    cache.put(cacheKey,JSON.stringify(sorted),DOCUMENT_INDEX_CACHE_SECONDS);
  } catch (_) {}
  return sorted;
}

function walkSubmissionFolder(folder,out) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const folderName = folder.getName();
    let type = 'document';
    if (folderName === 'Bank Statements') type = 'statement';
    else if (folderName === 'Identification') type = 'identification';
    else if (folderName === 'Financial Statements') type = 'financial';
    out.push({
      id:file.getId(),
      name:file.getName(),
      date:file.getDateCreated(),
      type,
      size:file.getSize(),
      mimeType:file.getMimeType(),
      url:file.getUrl()
    });
  }

  const folders = folder.getFolders();
  while (folders.hasNext()) {
    walkSubmissionFolder(folders.next(),out);
  }
}

function listDocuments(record) {
  return listSubmissionDocuments(record).map(doc => ({
    name:doc.name,
    date:doc.date,
    url:doc.url || '',
    type:doc.type
  }));
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

function parseStringArray(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean);
  } catch (_) {}
  return raw.split(',').map(item => item.trim()).filter(Boolean);
}

function adminSendLenderPackage(p) {
  requireAdminToken(p);

  const applicationId = String(p.applicationId || '').trim();
  if (!applicationId) throw new Error('Application ID is required');

  const record = findApplication(applicationId);
  const lenderIds = [...new Set(parseStringArray(p.lenderIds))];
  const fileIds = [...new Set(parseStringArray(p.fileIds))];
  const subjectTemplate = String(p.subject || '').trim().slice(0,180);
  const bodyTemplate = String(p.body || '').trim().slice(0,5000);

  if (!lenderIds.length) throw new Error('Select at least one lender');
  if (!fileIds.length) throw new Error('Select at least one document');
  if (!subjectTemplate) throw new Error('Email subject is required');
  if (!bodyTemplate) throw new Error('Email message is required');

  const lenderMap = Object.fromEntries(allLenders().map(lender => [String(lender.lenderId),lender]));
  const lenders = lenderIds.map(id => lenderMap[id]).filter(Boolean);
  if (lenders.length !== lenderIds.length) throw new Error('One or more selected lenders are no longer available');

  const permitted = Object.fromEntries(listSubmissionDocuments(record).map(doc => [String(doc.id),doc]));
  const docs = fileIds.map(id => permitted[id]).filter(Boolean);
  if (docs.length !== fileIds.length) throw new Error('One or more selected documents are no longer available in this client file');

  const totalBytes = docs.reduce((sum,doc) => sum + Number(doc.size || 0),0);
  if (totalBytes > MAX_LENDER_PACKAGE_BYTES) {
    throw new Error('Package is too large to email safely. Please keep lender packages under 17 MB and try again.');
  }

  const nameCounts = {};
  const attachmentManifest = [];
  const attachments = docs.map(doc => {
    const file = DriveApp.getFileById(doc.id);
    const blob = file.getBlob();
    const blobBytes = blob.getBytes().length;

    if (!blobBytes) {
      throw new Error('Attachment is empty and cannot be sent: ' + String(doc.name || file.getName() || doc.id));
    }

    const originalName = String(doc.name || file.getName() || 'document').trim() || 'document';
    const nameKey = originalName.toLowerCase();
    nameCounts[nameKey] = (nameCounts[nameKey] || 0) + 1;

    let outgoingName = originalName;
    if (nameCounts[nameKey] > 1) {
      const dot = originalName.lastIndexOf('.');
      const suffix = ' (' + nameCounts[nameKey] + ')';
      outgoingName = dot > 0
        ? originalName.slice(0,dot) + suffix + originalName.slice(dot)
        : originalName + suffix;
    }

    blob.setName(outgoingName);
    attachmentManifest.push({
      id:String(doc.id || ''),
      originalName,
      outgoingName,
      type:String(doc.type || 'document'),
      mimeType:String(blob.getContentType() || doc.mimeType || ''),
      driveBytes:Number(doc.size || 0),
      blobBytes
    });
    return blob;
  });

  const verifiedBlobBytes = attachmentManifest.reduce((sum,item) => sum + Number(item.blobBytes || 0),0);
  if (verifiedBlobBytes > MAX_LENDER_PACKAGE_BYTES) {
    throw new Error('Verified attachments are too large to email safely. Please keep lender packages under 17 MB and try again.');
  }
  const from = String(CONFIG.CLIENT_NOTIFICATION_FROM || '').trim().toLowerCase();
  const aliases = GmailApp.getAliases().map(alias => String(alias || '').trim().toLowerCase());
  if (!from || !aliases.includes(from)) {
    throw new Error(CONFIG.CLIENT_NOTIFICATION_FROM + ' is not available as a Gmail Send mail as alias for the Apps Script account.');
  }

  const sent = [];
  const failed = [];

  const companyName = String(p.companyName || record.business || '').trim();
  if (!companyName) {
    throw new Error('Business name is required before sending a lender package.');
  }

  // Prevent an identical package from being sent twice when the browser
  // times out after Gmail has already accepted the first request.
  const packageCache = CacheService.getScriptCache();
  const packageFingerprint = hash(JSON.stringify({
    applicationId,
    lenderIds:[...lenderIds].sort(),
    fileIds:[...fileIds].sort(),
    subjectTemplate,
    bodyTemplate,
    companyName
  })).slice(0,48);
  const packageCacheKey = 'tfc-lender-package-' + packageFingerprint;

  const packageLock = LockService.getScriptLock();
  packageLock.waitLock(20000);
  try {
    const cachedPackage = packageCache.get(packageCacheKey);
    if (cachedPackage) {
      if (cachedPackage === 'processing') {
        return {
          ok:false,
          error:'This exact lender package is already being sent. Please wait a moment before trying again.'
        };
      }
      try {
        const previousResult = JSON.parse(cachedPackage);
        return { ...previousResult, deduplicated:true };
      } catch (_) {}
    }
    packageCache.put(packageCacheKey,'processing',600);
  } finally {
    packageLock.releaseLock();
  }

  lenders.forEach(lender => {
    const lenderName = String(lender.name || 'Lender').trim();
    const subject = subjectTemplate
      .replace(/\{Lender Name\}/gi,lenderName)
      .replace(/\{Company Name\}/gi,companyName);
    const bodyBase = bodyTemplate
      .replace(/\{Lender Name\}/gi,lenderName)
      .replace(/\{Company Name\}/gi,companyName);
    const attachmentList = attachmentManifest
      .map((item,index) => (index + 1) + '. ' + item.outgoingName)
      .join('\n');
    const body = bodyBase + '\n\nAttachments included:\n' + attachmentList;

    try {
      GmailApp.sendEmail(String(lender.email || '').trim(),subject,body,{
        from:CONFIG.CLIENT_NOTIFICATION_FROM,
        name:CONFIG.COMPANY_NAME,
        replyTo:CONFIG.CLIENT_NOTIFICATION_FROM,
        attachments
      });

      sent.push({
        lenderId:String(lender.lenderId || ''),
        name:String(lender.name || ''),
        email:String(lender.email || '')
      });

      appendAuditEvent({
        applicationId:record.applicationId,
        actorType:'ADMIN',
        actorId:CONFIG.ADMIN_EMAIL,
        action:'LENDER_PACKAGE_SENT',
        field:'lenderSubmission',
        newValue:String(lender.name || ''),
        summary:'Lender package sent to ' + String(lender.name || lender.email || 'lender') + ' · ' + docs.length + ' document' + (docs.length === 1 ? '' : 's'),
        metadata:{
          lenderId:String(lender.lenderId || ''),
          lenderEmail:String(lender.email || ''),
          subject,
          documents:attachmentManifest,
          totalBytes,
          verifiedBlobBytes
        }
      });
    } catch (err) {
      const error = err.message || String(err);
      failed.push({
        lenderId:String(lender.lenderId || ''),
        name:String(lender.name || ''),
        email:String(lender.email || ''),
        error
      });

      appendAuditEvent({
        applicationId:record.applicationId,
        actorType:'ADMIN',
        actorId:CONFIG.ADMIN_EMAIL,
        action:'LENDER_PACKAGE_FAILED',
        field:'lenderSubmission',
        newValue:String(lender.name || ''),
        summary:'Lender package could not be sent to ' + String(lender.name || lender.email || 'lender'),
        metadata:{
          lenderId:String(lender.lenderId || ''),
          lenderEmail:String(lender.email || ''),
          error
        }
      });
    }
  });

  const result = {
    ok:true,
    sent,
    failed,
    documentCount:attachments.length,
    totalBytes,
    verifiedBlobBytes,
    attachments:attachmentManifest
  };

  try {
    packageCache.put(packageCacheKey,JSON.stringify(result),1800);
  } catch (_) {}

  return result;
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

function safeClient(record) {
  const result = {};
  CLIENT_SAFE_FIELDS.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(record,field)) result[field] = record[field];
  });
  return result;
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