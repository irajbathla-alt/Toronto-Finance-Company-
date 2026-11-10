const FIREBASE_TEST_CONFIG = {
  SHEET_ID: '1pRN82iNCVpU31DJQA3xUrMVkMcPRPv1Rl69WH3VRco4',
  FIREBASE_API_KEY: 'AIzaSyAXIObBDa-i8W_wAUtt43FXracH7ezPhlA',
  FIREBASE_PROJECT_ID: 'toronto-finance-company-auth',
  LIVE_CRM_URL: 'https://script.google.com/macros/s/AKfycbxvkD5U6shFqseYlralB4VTQ_MbK42HbiPHXmZvAqgj1NXkwcMGkvkimcsYu2VNd7m-/exec',
  APPLICATIONS_SHEET: 'Applications',
  MAPPING_SHEET: 'Firebase Auth Test',
  REQUEST_CACHE_SECONDS: 300
};

const FIREBASE_TEST_MAPPING_HEADERS = [
  'created','updated','firebaseUid','email','applicationId','provider','status'
];

function doGet(e) {
  try {
    const p = { ...((e && e.parameter) || {}) };
    const callback = p.callback;
    if (!p.action || p.action === 'health') {
      return firebaseTestOutput({
        ok:true,
        service:'Toronto Finance Company Firebase Test Bridge',
        mode:'TEST_ONLY',
        firebaseProject:FIREBASE_TEST_CONFIG.FIREBASE_PROJECT_ID
      },callback);
    }

    if (p.action === 'firebaseTestRequestStatus') {
      return firebaseTestOutput(firebaseTestRequestStatus(p),callback);
    }

    throw new Error('Unknown test action');
  } catch (err) {
    return firebaseTestOutput(
      { ok:false, error:err.message || String(err) },
      e && e.parameter && e.parameter.callback
    );
  }
}

function doPost(e) {
  let p = {};
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (raw) {
      try { p = JSON.parse(raw); } catch (_) {}
    }
    if (!Object.keys(p).length) p = { ...((e && e.parameter) || {}) };

    let result;
    if (p.action === 'createAccountFirebaseTest') {
      result = createAccountFirebaseTest(p);
    } else if (p.action === 'clientLoginFirebaseTest') {
      result = clientLoginFirebaseTest(p);
    } else {
      throw new Error('Unknown test action');
    }

    firebaseTestCacheResult(p.requestId,result);
    return firebaseTestJson(result);
  } catch (err) {
    const result = { ok:false, error:err.message || String(err) };
    try { firebaseTestCacheResult(p.requestId,result); } catch (_) {}
    return firebaseTestJson(result);
  }
}

function firebaseTestOutput(value, callback) {
  if (callback) {
    const cb = String(callback).replace(/[^a-zA-Z0-9_.$]/g,'');
    return ContentService
      .createTextOutput(cb + '(' + JSON.stringify(value) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return firebaseTestJson(value);
}

function firebaseTestJson(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function firebaseTestRequestCacheKey(requestId) {
  const id = String(requestId || '').trim();
  if (!/^[a-zA-Z0-9_-]{20,120}$/.test(id)) {
    throw new Error('Invalid test request ID');
  }
  return 'tfc-firebase-test-' + id;
}

function firebaseTestCacheResult(requestId, result) {
  if (!requestId) return;
  CacheService.getScriptCache().put(
    firebaseTestRequestCacheKey(requestId),
    JSON.stringify(result),
    FIREBASE_TEST_CONFIG.REQUEST_CACHE_SECONDS
  );
}

function firebaseTestRequestStatus(p) {
  const raw = CacheService.getScriptCache().get(firebaseTestRequestCacheKey(p.requestId));
  if (!raw) return { ok:true, pending:true };
  try {
    return { ok:true, pending:false, result:JSON.parse(raw) };
  } catch (_) {
    return { ok:false, pending:false, error:'Test request result could not be read' };
  }
}

function firebaseTestSpreadsheet() {
  return SpreadsheetApp.openById(FIREBASE_TEST_CONFIG.SHEET_ID);
}

function firebaseTestApplicationsSheet() {
  const sh = firebaseTestSpreadsheet().getSheetByName(FIREBASE_TEST_CONFIG.APPLICATIONS_SHEET);
  if (!sh) throw new Error('Applications sheet not found');
  return sh;
}

function firebaseTestMappingSheet() {
  const ss = firebaseTestSpreadsheet();
  let sh = ss.getSheetByName(FIREBASE_TEST_CONFIG.MAPPING_SHEET);

  if (!sh) {
    sh = ss.insertSheet(FIREBASE_TEST_CONFIG.MAPPING_SHEET);
    sh.getRange(1,1,1,FIREBASE_TEST_MAPPING_HEADERS.length)
      .setValues([FIREBASE_TEST_MAPPING_HEADERS]);
    return sh;
  }

  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,FIREBASE_TEST_MAPPING_HEADERS.length)
      .setValues([FIREBASE_TEST_MAPPING_HEADERS]);
  }

  return sh;
}

function firebaseTestHeaders(sh) {
  return sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]
    .map(value => String(value || '').trim());
}

function firebaseTestRowObject(headers,row) {
  return Object.fromEntries(headers.map((header,index) => [header,row[index]]));
}

function firebaseTestFindInSheet(sh,headers,field,value) {
  const index = headers.indexOf(field);
  if (index < 0 || sh.getLastRow() < 2) return null;

  const found = sh
    .getRange(2,index+1,sh.getLastRow()-1,1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .matchCase(false)
    .findNext();

  return found ? { sh, headers, rowNumber:found.getRow() } : null;
}

function firebaseTestRead(found) {
  const row = found.sh.getRange(found.rowNumber,1,1,found.headers.length).getValues()[0];
  return firebaseTestRowObject(found.headers,row);
}

function firebaseTestFindApplication(applicationId) {
  const sh = firebaseTestApplicationsSheet();
  const headers = firebaseTestHeaders(sh);
  const found = firebaseTestFindInSheet(sh,headers,'applicationId',applicationId);
  if (!found) throw new Error('Test application not found');
  return firebaseTestRead(found);
}

function firebaseTestAppendApplication(record) {
  const sh = firebaseTestApplicationsSheet();
  const headers = firebaseTestHeaders(sh);
  const row = headers.map(header => record[header] ?? '');
  sh.getRange(sh.getLastRow()+1,1,1,headers.length).setValues([row]);
}

function firebaseTestAppendMapping(record) {
  const sh = firebaseTestMappingSheet();
  const headers = firebaseTestHeaders(sh);
  const row = headers.map(header => record[header] ?? '');
  sh.getRange(sh.getLastRow()+1,1,1,headers.length).setValues([row]);
}

function firebaseTestMappingByUid(uid) {
  const sh = firebaseTestMappingSheet();
  const headers = firebaseTestHeaders(sh);
  const found = firebaseTestFindInSheet(sh,headers,'firebaseUid',uid);
  return found ? firebaseTestRead(found) : null;
}

function firebaseTestEmailExists(email) {
  const sh = firebaseTestApplicationsSheet();
  const headers = firebaseTestHeaders(sh);
  return Boolean(firebaseTestFindInSheet(sh,headers,'email',email));
}

function firebaseTestApplicationId(uid) {
  const stamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || 'America/Vancouver',
    'yyyyMMdd-HHmmss'
  );
  const suffix = String(uid || '').replace(/[^a-zA-Z0-9]/g,'').slice(-6).toUpperCase() || 'TEST';
  return 'TFC-FB-' + stamp + '-' + suffix;
}

function firebaseTestVerifyIdToken(idToken) {
  const token = String(idToken || '').trim();
  if (token.length < 100 || token.length > 10000) {
    throw new Error('Firebase session token is missing or invalid');
  }

  const response = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' +
      encodeURIComponent(FIREBASE_TEST_CONFIG.FIREBASE_API_KEY),
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
    throw new Error('Firebase session could not be verified');
  }

  const user = body.users[0];
  const uid = String(user.localId || '').trim();
  const email = String(user.email || '').trim().toLowerCase();
  const providers = (user.providerUserInfo || [])
    .map(item => String(item.providerId || '').trim())
    .filter(Boolean);
  const provider = providers.includes('google.com')
    ? 'google.com'
    : (providers[0] || 'firebase');

  if (!uid || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Firebase account is missing a valid email address');
  }
  if (user.emailVerified !== true) {
    throw new Error('Please verify your Firebase email before continuing');
  }

  return { uid,email,provider,emailVerified:true };
}

function firebaseTestSafeClient(record) {
  const allowed = [
    'applicationId','created','updated','name','email','phone','business','status','statements',
    'signatureConfirmed','signatureConfirmedAt','advisor','messageTitle','messageBody',
    'approvedAmount','quote','term','paymentFrequency','paymentAmount','numberPayments',
    'totalRepayment','documentsRequested','additionalDocsEnabled','clientDecision',
    'clientDecisionNote','clientDecisionAt','chatHistory','driveUrl'
  ];

  const safe = {};
  allowed.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(record,key)) safe[key] = record[key];
  });
  safe.documents = [];
  return safe;
}

function createAccountFirebaseTest(p) {
  const firebase = firebaseTestVerifyIdToken(p.firebaseIdToken);
  const name = String(p.name || '').trim();
  const phone = String(p.phone || '').trim();

  if (!name) throw new Error('Name is required');
  if (phone.replace(/\D/g,'').length < 7) {
    throw new Error('A valid phone number is required');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  let record;
  let existing = false;

  try {
    const mapped = firebaseTestMappingByUid(firebase.uid);
    if (mapped) {
      if (String(mapped.email || '').trim().toLowerCase() !== firebase.email) {
        throw new Error('Firebase test mapping email mismatch');
      }
      record = firebaseTestFindApplication(mapped.applicationId);
      existing = true;
    } else {
      if (firebaseTestEmailExists(firebase.email)) {
        throw new Error(
          'This email already exists in the Applications sheet. Use a new test email so no existing client is changed.'
        );
      }

      const now = new Date();
      const applicationId = firebaseTestApplicationId(firebase.uid);

      record = {
        applicationId,
        created:now,
        updated:now,
        name,
        email:firebase.email,
        passwordHash:'',
        phone,
        business:'',
        address:'',
        city:'',
        province:'',
        postal:'',
        industry:'',
        revenue:'',
        requested:'',
        years:'',
        purpose:'',
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
        additionalDocsEnabled:'',
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

      firebaseTestAppendApplication(record);
      firebaseTestAppendMapping({
        created:now,
        updated:now,
        firebaseUid:firebase.uid,
        email:firebase.email,
        applicationId,
        provider:firebase.provider,
        status:'ACTIVE_TEST'
      });
    }
  } finally {
    lock.releaseLock();
  }

  const notification = existing
    ? { ok:true, sent:true, alreadySent:true }
    : firebaseTestTriggerExistingSignupNotification(record);

  return {
    ok:true,
    mode:'TEST_ONLY',
    data:firebaseTestSafeClient(record),
    firebase:{ provider:firebase.provider, email:firebase.email },
    notification,
    deduplicated:existing
  };
}

function clientLoginFirebaseTest(p) {
  const firebase = firebaseTestVerifyIdToken(p.firebaseIdToken);
  const mapped = firebaseTestMappingByUid(firebase.uid);

  if (!mapped) {
    throw new Error('No Firebase test application is linked to this account yet');
  }
  if (String(mapped.email || '').trim().toLowerCase() !== firebase.email) {
    throw new Error('Firebase test account verification failed');
  }

  const record = firebaseTestFindApplication(mapped.applicationId);
  if (String(record.email || '').trim().toLowerCase() !== firebase.email) {
    throw new Error('Applications sheet email does not match Firebase');
  }

  return {
    ok:true,
    mode:'TEST_ONLY',
    data:firebaseTestSafeClient(record),
    firebase:{ provider:firebase.provider, email:firebase.email }
  };
}

function firebaseTestTriggerExistingSignupNotification(record) {
  try {
    const response = UrlFetchApp.fetch(FIREBASE_TEST_CONFIG.LIVE_CRM_URL,{
      method:'post',
      contentType:'application/json',
      payload:JSON.stringify({
        action:'sendSignupNotification',
        applicationId:record.applicationId,
        email:record.email
      }),
      muteHttpExceptions:true
    });

    let body = {};
    try { body = JSON.parse(response.getContentText() || '{}'); } catch (_) {}

    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300 && body.ok) {
      return body;
    }

    return {
      ok:false,
      sent:false,
      error:body.error || ('Existing signup notification returned HTTP ' + response.getResponseCode())
    };
  } catch (err) {
    return { ok:false, sent:false, error:err.message || String(err) };
  }
}
