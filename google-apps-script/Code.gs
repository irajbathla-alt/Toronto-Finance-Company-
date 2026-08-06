const CONFIG={
  SHEET_ID:'1pRN82iNCVpU31DJQA3xUrMVkMcPRPv1Rl69WH3VRco4',
  ROOT_FOLDER_ID:'1ao4Tlk65yxtr8yHGJaNGqyKPOHYFfXjb',
  ADMIN_EMAIL:'admin@torontofinance.ca',
  ADMIN_PASSWORD:'CHANGE_THIS_ADMIN_PASSWORD',
  MIN_STATEMENTS:6
};

const HEADERS=['applicationId','created','updated','name','email','passwordHash','phone','business','address','city','province','postal','industry','revenue','requested','years','purpose','status','statements','advisor','messageTitle','messageBody','approvedAmount','quote','notes','driveFolderId','driveUrl'];

function doGet(e){
  try{
    if(e&&e.parameter&&e.parameter.action==='health') return json(healthCheck());
    return json({ok:true,service:'Toronto Finance Company CRM',hint:'Add ?action=health to test Sheet and Drive access'});
  }catch(err){return json({ok:false,error:err.message,stack:String(err.stack||'')});}
}

function doPost(e){
  try{
    const p=parseRequest(e);
    const fn={createAccount,clientLogin,getClient,uploadDocument,adminLogin,adminList,adminUpdate,health:healthCheck}[p.action];
    if(!fn) throw new Error('Unknown action: '+String(p.action||''));
    return json(fn(p));
  }catch(err){
    return json({ok:false,error:err.message,stack:String(err.stack||'')});
  }
}

function parseRequest(e){
  const raw=e&&e.postData&&e.postData.contents?e.postData.contents:'';
  if(raw){
    try{return JSON.parse(raw);}catch(_){ }
  }
  return e&&e.parameter?e.parameter:{};
}

function json(v){return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);}

function healthCheck(){
  const out={ok:true,service:'Toronto Finance Company CRM',sheetId:CONFIG.SHEET_ID,folderId:CONFIG.ROOT_FOLDER_ID};
  try{
    const ss=SpreadsheetApp.openById(CONFIG.SHEET_ID);
    out.spreadsheetName=ss.getName();
    const sh=ensureSheet();
    out.applicationsSheet=sh.getName();
    out.rows=Math.max(0,sh.getLastRow()-1);
    out.sheetWritable=true;
  }catch(err){out.ok=false;out.sheetWritable=false;out.sheetError=err.message;}
  try{
    const folder=DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    out.rootFolderName=folder.getName();
    out.driveWritable=true;
  }catch(err){out.ok=false;out.driveWritable=false;out.driveError=err.message;}
  return out;
}

function ensureSheet(){
  const ss=SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sh=ss.getSheetByName('Applications');
  if(!sh) sh=ss.insertSheet('Applications');
  if(sh.getLastRow()===0){
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
  }else{
    const current=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),HEADERS.length)).getValues()[0];
    const mismatch=HEADERS.some((h,i)=>current[i]!==h);
    if(mismatch) sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  }
  return sh;
}

function sheet(){return ensureSheet();}
function rows(){const values=sheet().getDataRange().getValues();return values.slice(1).filter(r=>r[0]).map(r=>Object.fromEntries(HEADERS.map((h,i)=>[h,r[i]])));}
function hash(v){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(v));return bytes.map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function nextId(){return 'TFC-'+String(rows().length+1).padStart(6,'0');}

function createAccount(p){
  if(!p.email||!p.password) throw new Error('Email and password are required');
  if(rows().some(r=>String(r.email).toLowerCase()===String(p.email).toLowerCase())) throw new Error('An account already exists for this email');
  const id=nextId();
  const root=DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const folder=root.createFolder(`${id} - ${p.business||p.name||p.email}`);
  folder.createFolder('Bank Statements');
  folder.createFolder('Identification');
  folder.createFolder('Financial Statements');
  folder.createFolder('Other Documents');
  const now=new Date();
  const record={...Object.fromEntries(HEADERS.map(h=>[h,''])),...p,applicationId:id,created:now,updated:now,passwordHash:hash(p.password),status:'Account Created',statements:0,messageTitle:'Welcome',messageBody:'Your account has been created. Please upload six recent business bank statements.',driveFolderId:folder.getId(),driveUrl:folder.getUrl()};
  delete record.password;
  sheet().appendRow(HEADERS.map(h=>record[h]??''));
  SpreadsheetApp.flush();
  return {ok:true,data:safe(record)};
}

function clientLogin(p){const r=rows().find(x=>String(x.email).toLowerCase()===String(p.email).toLowerCase()&&x.passwordHash===hash(p.password));if(!r)throw new Error('Invalid email or password');return {ok:true,data:safe(r)};}
function getClient(p){const r=find(p.applicationId);return {ok:true,data:safe({...r,documents:listDocs(r)})};}

function uploadDocument(p){
  const r=find(p.applicationId);
  if(!p.base64||!p.fileName) throw new Error('Missing file data');
  const folder=DriveApp.getFolderById(r.driveFolderId);
  const target=p.type==='statement'?getChild(folder,'Bank Statements'):getChild(folder,'Other Documents');
  const blob=Utilities.newBlob(Utilities.base64Decode(p.base64),p.mimeType||'application/pdf',p.fileName);
  target.createFile(blob);
  if(p.type==='statement'){
    const count=countStatements(r);
    update(r.applicationId,{statements:count,status:count>=CONFIG.MIN_STATEMENTS?'Ready for Review':'Statements Required',messageTitle:count>=CONFIG.MIN_STATEMENTS?'Documents Received':'Statements Required',messageBody:count>=CONFIG.MIN_STATEMENTS?'Thank you. Your statements have been received and your file is ready for review.':`Please upload ${CONFIG.MIN_STATEMENTS-count} more monthly statement(s).`});
  }
  return {ok:true};
}

function adminLogin(p){if(String(p.email).toLowerCase()!==CONFIG.ADMIN_EMAIL.toLowerCase()||p.password!==CONFIG.ADMIN_PASSWORD)throw new Error('Invalid admin credentials');return {ok:true};}
function adminList(){return {ok:true,data:rows().map(r=>safe({...r,documents:listDocs(r)}))};}
function adminUpdate(p){find(p.applicationId);update(p.applicationId,p);return {ok:true,data:safe(find(p.applicationId))};}
function find(id){const r=rows().find(x=>x.applicationId===id);if(!r)throw new Error('Application not found');return r;}
function update(id,patch){const sh=sheet(),data=sh.getDataRange().getValues();for(let i=1;i<data.length;i++){if(data[i][0]===id){HEADERS.forEach((h,j)=>{if(Object.prototype.hasOwnProperty.call(patch,h))data[i][j]=patch[h];});data[i][HEADERS.indexOf('updated')]=new Date();sh.getRange(i+1,1,1,HEADERS.length).setValues([data[i]]);SpreadsheetApp.flush();return;}}throw new Error('Application not found');}
function getChild(folder,name){const it=folder.getFoldersByName(name);return it.hasNext()?it.next():folder.createFolder(name);}
function countStatements(r){return countFiles(getChild(DriveApp.getFolderById(r.driveFolderId),'Bank Statements'));}
function countFiles(folder){let n=0,it=folder.getFiles();while(it.hasNext()){it.next();n++;}return n;}
function listDocs(r){if(!r.driveFolderId)return[];const out=[];walk(DriveApp.getFolderById(r.driveFolderId),out);return out;}
function walk(folder,out){let f=folder.getFiles();while(f.hasNext()){const x=f.next();out.push({name:x.getName(),date:x.getDateCreated(),url:x.getUrl(),type:folder.getName()==='Bank Statements'?'statement':'document'});}let d=folder.getFolders();while(d.hasNext())walk(d.next(),out);}
function safe(r){const x={...r};delete x.passwordHash;return x;}
