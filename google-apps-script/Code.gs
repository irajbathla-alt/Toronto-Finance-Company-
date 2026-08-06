const CONFIG={
  SHEET_ID:'PASTE_GOOGLE_SHEET_ID',
  ROOT_FOLDER_ID:'PASTE_GOOGLE_DRIVE_ROOT_FOLDER_ID',
  ADMIN_EMAIL:'admin@torontofinance.ca',
  ADMIN_PASSWORD:'CHANGE_THIS_ADMIN_PASSWORD',
  MIN_STATEMENTS:6
};
const HEADERS=['applicationId','created','updated','name','email','passwordHash','phone','business','address','city','province','postal','industry','revenue','requested','years','purpose','status','statements','advisor','messageTitle','messageBody','approvedAmount','quote','notes','driveFolderId','driveUrl'];
function doGet(){return json({ok:true,service:'Toronto Finance Company CRM'});}
function doPost(e){try{const p=JSON.parse(e.postData.contents||'{}');const fn={createAccount,clientLogin,getClient,uploadDocument,adminLogin,adminList,adminUpdate}[p.action];if(!fn)throw new Error('Unknown action');return json(fn(p));}catch(err){return json({ok:false,error:err.message});}}
function json(v){return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);}
function sheet(){const ss=SpreadsheetApp.openById(CONFIG.SHEET_ID);let sh=ss.getSheetByName('Applications');if(!sh){sh=ss.insertSheet('Applications');sh.appendRow(HEADERS);}return sh;}
function rows(){const values=sheet().getDataRange().getValues();return values.slice(1).map(r=>Object.fromEntries(HEADERS.map((h,i)=>[h,r[i]])));}
function hash(v){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(v));return bytes.map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function nextId(){return 'TFC-'+String(rows().length+1).padStart(6,'0');}
function createAccount(p){if(!p.email||!p.password)throw new Error('Email and password are required');if(rows().some(r=>String(r.email).toLowerCase()===String(p.email).toLowerCase()))throw new Error('An account already exists for this email');const id=nextId();const root=DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);const folder=root.createFolder(`${id} - ${p.business||p.name||p.email}`);folder.createFolder('Bank Statements');folder.createFolder('Identification');folder.createFolder('Financial Statements');folder.createFolder('Other Documents');const now=new Date();const record={...Object.fromEntries(HEADERS.map(h=>[h,''])),...p,applicationId:id,created:now,updated:now,passwordHash:hash(p.password),status:'Account Created',statements:0,messageTitle:'Welcome',messageBody:'Your account has been created. Please complete your business profile and upload six recent bank statements.',driveFolderId:folder.getId(),driveUrl:folder.getUrl()};delete record.password;sheet().appendRow(HEADERS.map(h=>record[h]??''));return {ok:true,data:safe(record)};}
function clientLogin(p){const r=rows().find(x=>String(x.email).toLowerCase()===String(p.email).toLowerCase()&&x.passwordHash===hash(p.password));if(!r)throw new Error('Invalid email or password');return {ok:true,data:safe(r)};}
function getClient(p){const r=find(p.applicationId);return {ok:true,data:safe({...r,documents:listDocs(r)})};}
function uploadDocument(p){const r=find(p.applicationId);const folder=DriveApp.getFolderById(r.driveFolderId);const target=p.type==='statement'?getChild(folder,'Bank Statements'):getChild(folder,'Other Documents');const blob=Utilities.newBlob(Utilities.base64Decode(p.base64),p.mimeType||'application/pdf',p.fileName);target.createFile(blob);if(p.type==='statement'){const count=countStatements(r);update(r.applicationId,{statements:count,status:count>=CONFIG.MIN_STATEMENTS?'Ready for Review':'Statements Required',messageTitle:count>=CONFIG.MIN_STATEMENTS?'Documents Received':'Statements Required',messageBody:count>=CONFIG.MIN_STATEMENTS?'Thank you. Your statements have been received and your file is ready for review.':`Please upload ${CONFIG.MIN_STATEMENTS-count} more monthly statement(s).`});}return {ok:true};}
function adminLogin(p){if(String(p.email).toLowerCase()!==CONFIG.ADMIN_EMAIL.toLowerCase()||p.password!==CONFIG.ADMIN_PASSWORD)throw new Error('Invalid admin credentials');return {ok:true};}
function adminList(){return {ok:true,data:rows().map(r=>safe({...r,documents:listDocs(r)}))};}
function adminUpdate(p){find(p.applicationId);update(p.applicationId,p);return {ok:true,data:safe(find(p.applicationId))};}
function find(id){const r=rows().find(x=>x.applicationId===id);if(!r)throw new Error('Application not found');return r;}
function update(id,patch){const sh=sheet(),data=sh.getDataRange().getValues();for(let i=1;i<data.length;i++){if(data[i][0]===id){HEADERS.forEach((h,j)=>{if(Object.prototype.hasOwnProperty.call(patch,h))data[i][j]=patch[h];});data[i][HEADERS.indexOf('updated')]=new Date();sh.getRange(i+1,1,1,HEADERS.length).setValues([data[i]]);return;}}}
function getChild(folder,name){const it=folder.getFoldersByName(name);return it.hasNext()?it.next():folder.createFolder(name);}
function countStatements(r){return countFiles(getChild(DriveApp.getFolderById(r.driveFolderId),'Bank Statements'));}
function countFiles(folder){let n=0,it=folder.getFiles();while(it.hasNext()){it.next();n++;}return n;}
function listDocs(r){if(!r.driveFolderId)return[];const out=[];walk(DriveApp.getFolderById(r.driveFolderId),out);return out;}
function walk(folder,out){let f=folder.getFiles();while(f.hasNext()){const x=f.next();out.push({name:x.getName(),date:x.getDateCreated(),url:x.getUrl(),type:folder.getName()==='Bank Statements'?'statement':'document'});}let d=folder.getFolders();while(d.hasNext())walk(d.next(),out);}
function safe(r){const x={...r};delete x.passwordHash;return x;}
