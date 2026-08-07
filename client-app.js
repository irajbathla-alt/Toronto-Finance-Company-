(() => {
  'use strict';

  const CRM = window.TFC_CRM;
  const cfg = window.TFC_CONFIG || {};
  const minimumStatements = Number(cfg.minimumStatements || 6);
  const $ = selector => document.querySelector(selector);
  const PIPELINE = ['Account Created','Statements Required','Ready for Review','Under Review','Conditional Approval','Approved','Funded'];
  let client = null;
  let refreshTimer = null;

  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2300)}
  function money(value){const n=Number(value||0);return n?`CA$${n.toLocaleString('en-CA')}`:'—'}
  function statusClass(status=''){if(['Approved','Funded','Conditional Approval'].includes(status))return'approved';if(status==='Declined')return'declined';if(status==='Under Review')return'review';if(['Ready for Review','Statements Required','Additional Documents Required'].includes(status))return'ready';return''}

  function showLogin(message=''){
    $('#login').classList.remove('hidden');
    $('#dashboard').classList.add('hidden');
    $('#loginMsg').textContent=message;
  }

  function renderPipeline(status){
    const current=PIPELINE.indexOf(status);
    $('#pipeline').innerHTML=PIPELINE.map((stage,index)=>{
      const cls=stage===status?'active':current>=0&&index<current?'done':'';
      return `<div class="pipeline-step ${cls}">${stage}</div>`;
    }).join('');
  }

  function renderApproval(data){
    const visible=['Conditional Approval','Approved','Funded'].includes(data.status);
    $('#approvalCard').classList.toggle('show',visible);
    if(!visible)return;
    $('#approvalStatus').textContent=data.status;
    $('#approvalAmount').textContent=money(data.approvedAmount);
    $('#approvalTerms').textContent=data.quote||'Please contact your advisor for the current product terms and conditions.';
  }

  function render(data){
    client=data;
    $('#login').classList.add('hidden');
    $('#dashboard').classList.remove('hidden');
    $('#hello').textContent=`Welcome, ${data.name||'Client'}`;
    $('#applicationId').textContent=`Application ${data.applicationId||''}`;
    $('#statusBadge').className=`status ${statusClass(data.status)}`;
    $('#statusBadge').textContent=data.status||'Account Created';
    $('#nextActionText').textContent=data.nextAction||'Please complete the next step shown below.';
    $('#advisorTitle').textContent=data.messageTitle||'Welcome';
    $('#advisorBody').textContent=data.messageBody||'Your Toronto Finance Company account has been created.';
    $('#statementCount').textContent=`${Number(data.statements||0)} of ${minimumStatements} uploaded`;
    $('#statementBar').style.width=`${Math.min(100,Number(data.statements||0)/minimumStatements*100)}%`;

    const signed=String(data.signatureConfirmed||'').toLowerCase()==='true' || data.signatureConfirmed===true;
    const complete=Number(data.statements||0)>=minimumStatements;
    $('#step1').classList.toggle('complete',signed);
    $('#step1Done').classList.toggle('hidden',!signed);
    $('#step2').classList.toggle('complete',complete);
    $('#openUpload').disabled=!signed;
    $('#signatureButton').disabled=signed;
    $('#signatureButton').textContent=signed?'Signature Step Confirmed':'I Have Finished Signing';
    $('#completion').classList.toggle('show',signed&&complete);
    renderPipeline(data.status||'Account Created');
    renderApproval(data);
  }

  async function refresh(showToast=false){
    if(!client?.applicationId)return;
    try{
      const result=await CRM.get('getClient',{applicationId:client.applicationId});
      render(result.data);
      if(showToast)toast('Dashboard refreshed');
    }catch(error){
      if(/session|unauthorized|expired/i.test(error.message||'')){CRM.logout();showLogin('Your secure session expired. Please log in again.');}
      else if(showToast)toast(error.message);
    }
  }

  async function login(){
    const email=$('#email').value.trim().toLowerCase();
    const password=$('#password').value;
    if(!/^\S+@\S+\.\S+$/.test(email))return $('#loginMsg').textContent='Please enter a valid email address.';
    if(!password)return $('#loginMsg').textContent='Please enter your password.';
    $('#loginBtn').disabled=true;$('#loginBtn').textContent='Signing In…';$('#loginMsg').textContent='Checking your secure account…';
    try{
      const result=await CRM.clientLogin(email,password);
      $('#loginMsg').textContent='';
      history.replaceState({},'', 'client-dashboard.html');
      render(result.data);
      startRefresh();
    }catch(error){$('#loginMsg').textContent=error.message;}
    finally{$('#loginBtn').disabled=false;$('#loginBtn').textContent='Log In';}
  }

  function openPanel(id){document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));$(`#${id}`).classList.add('active');$(`#${id}`).scrollIntoView({behavior:'smooth',block:'start'});}
  function closePanels(){document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));window.scrollTo({top:0,behavior:'smooth'});}

  async function confirmSignature(){
    if(!client?.applicationId)return;
    $('#signatureButton').disabled=true;$('#signatureButton').textContent='Saving…';
    try{
      const result=await CRM.post('clientConfirmSignature',{applicationId:client.applicationId},{timeout:12000});
      render(result.data);closePanels();toast('Signature step confirmed');
    }catch(error){toast(error.message);$('#signatureButton').disabled=false;$('#signatureButton').textContent='I Have Finished Signing';}
  }

  function fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error(`Could not read ${file.name}`));reader.readAsDataURL(file);});}

  async function uploadStatements(){
    if(!client?.applicationId)return;
    const files=[...$('#files').files];
    if(!files.length)return $('#uploadMsg').textContent='Select PDF bank statements first.';
    if(files.some(file=>file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')))return $('#uploadMsg').textContent='Only PDF bank statements can be uploaded.';
    $('#uploadBtn').disabled=true;$('#uploadMsg').className='notice';
    try{
      for(let i=0;i<files.length;i++){
        const file=files[i];
        $('#uploadMsg').textContent=`Uploading ${i+1} of ${files.length}: ${file.name}`;
        const base64=await fileToBase64(file);
        const result=await CRM.post('uploadDocument',{applicationId:client.applicationId,fileName:file.name,mimeType:file.type||'application/pdf',base64,type:'statement'},{timeout:60000});
        if(result.data)render(result.data);
      }
      $('#files').value='';
      $('#uploadMsg').className='notice success';
      $('#uploadMsg').textContent='Statements uploaded successfully.';
      toast('Documents received');
    }catch(error){$('#uploadMsg').className='notice error';$('#uploadMsg').textContent=error.message;}
    finally{$('#uploadBtn').disabled=false;}
  }

  function startRefresh(){if(refreshTimer)clearInterval(refreshTimer);refreshTimer=setInterval(()=>refresh(false),60000);}
  function logout(){if(refreshTimer)clearInterval(refreshTimer);CRM.logout();location.replace('index.html');}

  async function init(){
    $('#loginBtn').onclick=login;
    $('#password').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
    $('#logout').onclick=logout;
    $('#refresh').onclick=()=>refresh(true);
    $('#openSign').onclick=()=>openPanel('signPanel');
    $('#openUpload').onclick=()=>openPanel('uploadPanel');
    $('#signatureButton').onclick=confirmSignature;
    $('#uploadBtn').onclick=uploadStatements;
    document.querySelectorAll('[data-close]').forEach(button=>button.onclick=closePanels);

    const forceLogin=new URLSearchParams(location.search).get('login')==='1';
    if(forceLogin){CRM.logout();history.replaceState({},'', 'client-dashboard.html');showLogin();return;}
    const session=CRM.getSession();
    if(session?.role!=='client'||!session.applicationId){showLogin();return;}
    try{
      const result=await CRM.get('getClient',{applicationId:session.applicationId});
      render(result.data);startRefresh();
    }catch(_){CRM.logout();showLogin('For your security, please log in again.');}
  }

  document.addEventListener('DOMContentLoaded',init,{once:true});
})();