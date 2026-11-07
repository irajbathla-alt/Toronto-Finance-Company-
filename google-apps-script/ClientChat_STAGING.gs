/**
 * Toronto Finance Company — Client Chat STAGING MODULE
 *
 * IMPORTANT:
 * - This file is NOT wired into the deployed doGet/doPost action maps.
 * - It does NOT change the existing Applications sheet schema.
 * - When approved for final hookup, merge these functions into the deployed Apps Script
 *   and add the chat actions to the existing action maps.
 *
 * Uses a separate append-only sheet: "Client Messages".
 */

const CHAT_SHEET_NAME = 'Client Messages';
const CHAT_HEADERS = [
  'messageId',
  'timestamp',
  'applicationId',
  'senderType',
  'senderId',
  'senderName',
  'message',
  'readByClient',
  'readByAdvisor',
  'clientReadAt',
  'advisorReadAt'
];

function chatMessagesSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sh = ss.getSheetByName(CHAT_SHEET_NAME);

  if (!sh) {
    sh = ss.insertSheet(CHAT_SHEET_NAME);
    if (sh.getMaxColumns() < CHAT_HEADERS.length) {
      sh.insertColumnsAfter(sh.getMaxColumns(), CHAT_HEADERS.length - sh.getMaxColumns());
    }
    sh.getRange(1,1,1,CHAT_HEADERS.length).setValues([CHAT_HEADERS]);
    sh.setFrozenRows(1);
    const messageColumn = CHAT_HEADERS.indexOf('message') + 1;
    if (messageColumn > 0) {
      sh.getRange(1,messageColumn,sh.getMaxRows(),1).setNumberFormat('@');
    }
    return sh;
  }

  const width = Math.max(1, sh.getLastColumn());
  const current = sh.getRange(1,1,1,width).getValues()[0].map(v => String(v || '').trim());
  const merged = current.slice();
  CHAT_HEADERS.forEach(header => {
    if (!merged.includes(header)) merged.push(header);
  });

  if (sh.getMaxColumns() < merged.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), merged.length - sh.getMaxColumns());
  }
  if (merged.length !== width) {
    sh.getRange(1,1,1,merged.length).setValues([merged]);
  }

  const messageColumn = merged.indexOf('message') + 1;
  if (messageColumn > 0) {
    sh.getRange(1,messageColumn,sh.getMaxRows(),1).setNumberFormat('@');
  }

  return sh;
}

function chatHeaders_(sh) {
  return sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0]
    .map(v => String(v || '').trim());
}

function chatMessageText_(value) {
  const text = String(value || '').replace(/\r\n/g,'\n').trim();
  if (!text) throw new Error('Message cannot be empty');
  if (text.length > 3000) throw new Error('Message is too long');
  return text;
}

function chatLimit_(value) {
  const n = Number(value || 100);
  if (!Number.isFinite(n)) return 100;
  return Math.max(1, Math.min(200, Math.floor(n)));
}

function chatAppend_(record, senderType, senderId, senderName, message) {
  const sh = chatMessagesSheet_();
  const headers = chatHeaders_(sh);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const now = new Date();
    const item = {
      messageId:'MSG-' + Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase(),
      timestamp:now,
      applicationId:String(record.applicationId || ''),
      senderType:String(senderType || '').toUpperCase(),
      senderId:String(senderId || ''),
      senderName:String(senderName || ''),
      message:chatMessageText_(message),
      readByClient:String(senderType || '').toUpperCase() === 'CLIENT',
      readByAdvisor:String(senderType || '').toUpperCase() === 'ADVISOR',
      clientReadAt:String(senderType || '').toUpperCase() === 'CLIENT' ? now : '',
      advisorReadAt:String(senderType || '').toUpperCase() === 'ADVISOR' ? now : ''
    };

    const row = headers.map(header => Object.prototype.hasOwnProperty.call(item,header) ? item[header] : '');
    const rowNumber = sh.getLastRow() + 1;
    const messageColumn = headers.indexOf('message') + 1;

    if (messageColumn > 0) {
      sh.getRange(rowNumber,messageColumn).setNumberFormat('@');
    }
    sh.getRange(rowNumber,1,1,headers.length).setValues([row]);

    try {
      appendAuditEvent({
        applicationId:record.applicationId,
        actorType:item.senderType,
        actorId:item.senderId,
        action:'CHAT_MESSAGE_SENT',
        field:'clientChat',
        newValue:item.messageId,
        summary:item.senderType === 'CLIENT'
          ? 'Client sent a portal message'
          : 'Advisor sent a portal message',
        metadata:{ messageId:item.messageId }
      });
    } catch (_) {}

    return chatSafeMessage_(item);
  } finally {
    lock.releaseLock();
  }
}

function chatSafeMessage_(item) {
  return {
    messageId:String(item.messageId || ''),
    timestamp:item.timestamp,
    applicationId:String(item.applicationId || ''),
    senderType:String(item.senderType || ''),
    senderName:String(item.senderName || ''),
    message:String(item.message || ''),
    readByClient:item.readByClient === true || String(item.readByClient).toLowerCase() === 'true',
    readByAdvisor:item.readByAdvisor === true || String(item.readByAdvisor).toLowerCase() === 'true'
  };
}

function chatList_(applicationId, limitValue) {
  const sh = chatMessagesSheet_();
  const headers = chatHeaders_(sh);
  if (sh.getLastRow() < 2) return [];

  const values = sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues();
  const idIndex = headers.indexOf('applicationId');
  const items = values
    .filter(row => idIndex >= 0 && String(row[idIndex] || '') === String(applicationId || ''))
    .map(row => Object.fromEntries(headers.map((header,index) => [header,row[index]])))
    .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return items.slice(-chatLimit_(limitValue)).map(chatSafeMessage_);
}

function chatMarkRead_(applicationId, readerType) {
  const sh = chatMessagesSheet_();
  const headers = chatHeaders_(sh);
  if (sh.getLastRow() < 2) return 0;

  const appIndex = headers.indexOf('applicationId');
  const senderIndex = headers.indexOf('senderType');
  const readField = readerType === 'CLIENT' ? 'readByClient' : 'readByAdvisor';
  const readAtField = readerType === 'CLIENT' ? 'clientReadAt' : 'advisorReadAt';
  const readIndex = headers.indexOf(readField);
  const readAtIndex = headers.indexOf(readAtField);

  if ([appIndex,senderIndex,readIndex,readAtIndex].some(index => index < 0)) return 0;

  const range = sh.getRange(2,1,sh.getLastRow()-1,headers.length);
  const values = range.getValues();
  let changed = 0;
  const oppositeSender = readerType === 'CLIENT' ? 'ADVISOR' : 'CLIENT';
  const now = new Date();

  values.forEach(row => {
    if (
      String(row[appIndex] || '') === String(applicationId || '') &&
      String(row[senderIndex] || '').toUpperCase() === oppositeSender &&
      !(row[readIndex] === true || String(row[readIndex]).toLowerCase() === 'true')
    ) {
      row[readIndex] = true;
      row[readAtIndex] = now;
      changed++;
    }
  });

  if (changed) range.setValues(values);
  return changed;
}

function chatClientList(p) {
  const record = findApplication(p.applicationId);
  requireClientEmail(record,p.email);
  chatMarkRead_(record.applicationId,'CLIENT');
  const data = chatList_(record.applicationId,p.limit);
  return { ok:true, data };
}

function chatClientSend(p) {
  const record = findApplication(p.applicationId);
  const email = requireClientEmail(record,p.email);
  const item = chatAppend_(
    record,
    'CLIENT',
    email,
    String(record.name || 'Client'),
    p.message
  );
  return { ok:true, data:item };
}

function chatAdminList(p) {
  requireAdminToken(p);
  const record = findApplication(p.applicationId);
  chatMarkRead_(record.applicationId,'ADVISOR');
  const data = chatList_(record.applicationId,p.limit);
  return { ok:true, data };
}

function chatAdminSend(p) {
  requireAdminToken(p);
  const record = findApplication(p.applicationId);
  const senderName = String(record.advisor || 'Toronto Finance Company').trim() || 'Toronto Finance Company';
  const item = chatAppend_(
    record,
    'ADVISOR',
    CONFIG.ADMIN_EMAIL,
    senderName,
    p.message
  );
  return { ok:true, data:item };
}

/**
 * FINAL-HOOKUP ACTIONS (do not add until staging is approved):
 *
 * GET/POST:
 *   chatClientList
 *   chatClientSend
 *   chatAdminList
 *   chatAdminSend
 *
 * Client calls must include applicationId + email.
 * Admin calls must include applicationId + valid admin token.
 */
