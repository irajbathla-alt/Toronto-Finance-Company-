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
  'applicationId', 'created', 'updated', 'name', 'email', 'passwordHash',
  'phone', 'business', 'address', 'city', 'province', 'postal', 'industry',
  'revenue', 'requested', 'years', 'purpose', 'status', 'statements',
  'advisor', 'messageTitle', 'messageBody', 'approvedAmount', 'quote',
  'notes', 'driveFolderId', 'driveUrl', 'lastNotificationStatus',
  'lastNotificationAt', 'lastNotificationError'
];

const APPROVAL_EMAIL_STATUSES = ['Conditional Approval', 'Approved'];

function doGet(e) {
  try {
    const p = parseGet(e);
    if (!p.action || p.action === 'health') return output(healthCheck(), p.callback);
    const fn = { createAccount, clientLogin, getClient, adminLogin, adminList, adminUpdate }[p.action];
    if (!fn) throw new Error('Unknown action');
    return output(fn(p), p.callback);
  } catch (err) {
    return output({ ok: false, error: err.message }, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  try {
    const p = parsePost(e);
    const fn = { createAccount, clientLogin, getClient, uploadDocument, adminLogin, adminList, adminUpdate }[p.action];
    if (!fn) throw new Error('Unknown action');
    return json(fn(p));
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

function parseGet(e) {
  const q = (e && e.parameter) || {};
  if (q.payload) {
    try {
      return { ...JSON.parse(q.payload), callback: q.callback };
    } catch (_) {}
  }
  return { ...q };
}

function parsePost(e) {
  const raw = (e && e.postData && e.postData.contents) || '';
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {}
  }
  return { ...((e && e.parameter) || {}) };
}

function output(value, callback) {
  if (callback) {
    const cb = String(callback).replace(/[^a-zA-Z0-9_.$]/g, '');
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
    ok: true,
    service: 'Toronto Finance Company CRM',
    approvalEmailEnabled: true
  };

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    out.spreadsheetName = ss.getName();
    out.applicationsSheet = sheet().getName();
    out.sheetWritable = true;
  } catch (err) {
    out.ok = false;
    out.sheetError = err.message;
  }

  try {
    const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    out.rootFolderName = root.getName();
    out.driveWritable = true;
  } catch (err) {
    out.ok = false;
    out.driveError = err.message;
  }

  return out;
}

function sheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sh = ss.getSheetByName('Applications');

  if (!sh) {
    sh = ss.insertSheet('Applications');
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else {
    ensureHeaders(sh);
  }

  return sh;
}

function ensureHeaders(sh) {
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  const current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  let changed = false;

  HEADERS.forEach(header => {
    if (!current.includes(header)) {
      current.push(header);
      changed = true;
    }
  });

  if (changed) sh.getRange(1, 1, 1, current.length).setValues([current]);
}

function getHeaders(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function rows() {
  const sh = sheet();
  const headers = getHeaders(sh);
  const values = sh.getDataRange().getValues();

  return values
    .slice(1)
    .filter(row => row[headers.indexOf('applicationId')])
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

function hash(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value));
  return bytes.map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}

function nextId() {
  return 'TFC-' + String(rows().length + 1).padStart(6, '0');
}

function createAccount(p) {
  if (!p.email || !p.password) throw new Error('Email and password are required');
  if (rows().some(row => String(row.email).toLowerCase() === String(p.email).toLowerCase())) {
    throw new Error('An account already exists for this email');
  }

  const id = nextId();
  const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const folder = root.createFolder(`${id} - ${p.business || p.name || p.email}`);
  folder.createFolder('Bank Statements');
  folder.createFolder('Identification');
  folder.createFolder('Financial Statements');
  folder.createFolder('Other Documents');

  const now = new Date();
  const record = {
    ...p,
    applicationId: id,
    created: now,
    updated: now,
    passwordHash: hash(p.password),
    status: 'Account Created',
    statements: 0,
    messageTitle: 'Welcome',
    messageBody: 'Your account has been created. Please complete your application and upload six recent bank statements.',
    driveFolderId: folder.getId(),
    driveUrl: folder.getUrl(),
    lastNotificationStatus: '',
    lastNotificationAt: '',
    lastNotificationError: ''
  };

  delete record.password;
  appendRecord(record);
  return { ok: true, data: safe(record) };
}

function appendRecord(record) {
  const sh = sheet();
  const headers = getHeaders(sh);
  sh.appendRow(headers.map(header => record[header] ?? ''));
}

function clientLogin(p) {
  const record = rows().find(row =>
    String(row.email).toLowerCase() === String(p.email).toLowerCase() &&
    row.passwordHash === hash(p.password)
  );

  if (!record) throw new Error('Invalid email or password');
  return { ok: true, data: safe({ ...record, documents: listDocs(record) }) };
}

function getClient(p) {
  const record = find(p.applicationId);
  return { ok: true, data: safe({ ...record, documents: listDocs(record) }) };
}

function uploadDocument(p) {
  const record = find(p.applicationId);
  const folder = DriveApp.getFolderById(record.driveFolderId);
  const target = p.type === 'statement'
    ? getChild(folder, 'Bank Statements')
    : getChild(folder, 'Other Documents');

  const blob = Utilities.newBlob(
    Utilities.base64Decode(p.base64),
    p.mimeType || 'application/pdf',
    p.fileName
  );
  target.createFile(blob);

  if (p.type === 'statement') {
    const count = countStatements(record);
    update(record.applicationId, {
      statements: count,
      status: count >= CONFIG.MIN_STATEMENTS ? 'Ready for Review' : 'Statements Required',
      messageTitle: count >= CONFIG.MIN_STATEMENTS ? 'Documents Received' : 'Statements Required',
      messageBody: count >= CONFIG.MIN_STATEMENTS
        ? 'Thank you. Your statements have been received and your file is ready for review.'
        : `Please upload ${CONFIG.MIN_STATEMENTS - count} more monthly statement(s).`
    });
  }

  return { ok: true };
}

function adminLogin(p) {
  if (
    String(p.email).toLowerCase() !== CONFIG.ADMIN_EMAIL.toLowerCase() ||
    p.password !== CONFIG.ADMIN_PASSWORD
  ) {
    throw new Error('Invalid admin credentials');
  }
  return { ok: true };
}

function adminList() {
  return { ok: true, data: rows().map(record => safe({ ...record, documents: listDocs(record) })) };
}

function adminUpdate(p) {
  const before = find(p.applicationId);
  update(p.applicationId, p);

  const nextStatus = Object.prototype.hasOwnProperty.call(p, 'status')
    ? String(p.status)
    : String(before.status || '');

  let notification = { attempted: false, sent: false };
  const alreadyNotified = String(before.lastNotificationStatus || '') === nextStatus;

  if (APPROVAL_EMAIL_STATUSES.includes(nextStatus) && !alreadyNotified) {
    notification = sendApprovalNotification({ ...before, ...p, status: nextStatus });
  }

  return {
    ok: true,
    data: safe(find(p.applicationId)),
    notification
  };
}

function sendApprovalNotification(record) {
  const email = String(record.email || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    const error = 'Client email address is missing or invalid.';
    update(record.applicationId, { lastNotificationError: error });
    return { attempted: true, sent: false, error };
  }

  const status = String(record.status || 'Approved');
  const clientName = String(record.name || 'Client').trim();
  const subject = status === 'Approved'
    ? 'Your financing approval is ready to review'
    : 'A conditional approval is ready to review';

  const body = [
    `Hello ${clientName},`,
    '',
    'There is an important update regarding your financing application with Toronto Finance Company.',
    '',
    'Please log in to your secure client dashboard to review the approval and any conditions or next steps:',
    CONFIG.CLIENT_PORTAL_URL,
    '',
    'For your privacy, approval details are not included in this email.',
    '',
    CONFIG.COMPANY_NAME
  ].join('\n');

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#17130f;line-height:1.6">
      <div style="background:#17130f;color:#ffffff;padding:22px 26px">
        <div style="font-size:18px;letter-spacing:.04em">${escapeHtml(CONFIG.COMPANY_NAME)}</div>
      </div>
      <div style="padding:28px 26px;border:1px solid #e6ddd2;border-top:0">
        <p>Hello ${escapeHtml(clientName)},</p>
        <h2 style="font-weight:500;margin:18px 0 10px">${escapeHtml(status)} Available</h2>
        <p>There is an important update regarding your financing application.</p>
        <p>Please log in to your secure client dashboard to review the approval and any conditions or next steps.</p>
        <p style="margin:28px 0">
          <a href="${escapeHtml(CONFIG.CLIENT_PORTAL_URL)}" style="display:inline-block;background:#17130f;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:999px">Log In to Client Portal</a>
        </p>
        <p style="font-size:12px;color:#786f65">For your privacy, approval details are not included in this email.</p>
      </div>
    </div>`;

  try {
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Daily email sending quota has been reached.');

    MailApp.sendEmail(email, subject, body, {
      htmlBody,
      name: CONFIG.COMPANY_NAME,
      replyTo: CONFIG.ADMIN_EMAIL
    });

    const sentAt = new Date();
    update(record.applicationId, {
      lastNotificationStatus: status,
      lastNotificationAt: sentAt,
      lastNotificationError: ''
    });

    return { attempted: true, sent: true, status, sentAt };
  } catch (err) {
    const error = err.message || String(err);
    update(record.applicationId, { lastNotificationError: error });
    return { attempted: true, sent: false, error };
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function find(id) {
  const record = rows().find(row => String(row.applicationId) === String(id));
  if (!record) throw new Error('Application not found');
  return record;
}

function update(id, patch) {
  const sh = sheet();
  const headers = getHeaders(sh);
  const data = sh.getDataRange().getValues();
  const idIndex = headers.indexOf('applicationId');
  const updatedIndex = headers.indexOf('updated');

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    if (String(data[rowIndex][idIndex]) === String(id)) {
      headers.forEach((header, columnIndex) => {
        if (Object.prototype.hasOwnProperty.call(patch, header)) {
          data[rowIndex][columnIndex] = patch[header];
        }
      });

      if (updatedIndex >= 0) data[rowIndex][updatedIndex] = new Date();
      sh.getRange(rowIndex + 1, 1, 1, headers.length).setValues([data[rowIndex]]);
      return;
    }
  }

  throw new Error('Application not found');
}

function getChild(folder, name) {
  const iterator = folder.getFoldersByName(name);
  return iterator.hasNext() ? iterator.next() : folder.createFolder(name);
}

function countStatements(record) {
  return countFiles(getChild(DriveApp.getFolderById(record.driveFolderId), 'Bank Statements'));
}

function countFiles(folder) {
  let count = 0;
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    iterator.next();
    count += 1;
  }
  return count;
}

function listDocs(record) {
  if (!record.driveFolderId) return [];
  const out = [];
  walk(DriveApp.getFolderById(record.driveFolderId), out);
  return out;
}

function walk(folder, out) {
  let files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    out.push({
      name: file.getName(),
      date: file.getDateCreated(),
      url: file.getUrl(),
      type: folder.getName() === 'Bank Statements' ? 'statement' : 'document'
    });
  }

  let folders = folder.getFolders();
  while (folders.hasNext()) walk(folders.next(), out);
}

function safe(record) {
  const result = { ...record };
  delete result.passwordHash;
  return result;
}
