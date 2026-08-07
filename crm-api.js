(() => {
  'use strict';

  const cfg=window.TFC_CONFIG||{};
  const SESSION_KEY='tfc-v2-session';
  const BRIDGE_CHANNEL='tfc-crm-bridge';
  let backendPromise=null;

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const makeId=()=>window.crypto?.randomUUID?.()||`req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const normalize=v=>String(v??'').trim();

  function getSession(){
    try{
      const value=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
      if(!value?.token||!value?.role)return null;
      if(value.expiresAt&&Date.now()>Number(value.expiresAt)){clearSession();return null;}
      return value;
    }catch(_){return null;}
  }
  function setSession(value){if(!value?.token||!value?.role)throw new Error('Invalid CRM session.');sessionStorage.setItem(SESSION_KEY,JSON.stringify(value));}
  function clearSession(){sessionStorage.removeItem(SESSION_KEY);localStorage.removeItem('tfc-current-application');sessionStorage.removeItem('tfc-client-auth');}

  function jsonpAt(url,action,payload={},timeout=12000){
    return new Promise((resolve,reject)=>{
      if(!url)return reject(new Error('CRM service is not configured.'));
      const callback=`tfc_api_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script=document.createElement('script');
      const params=new URLSearchParams({action,callback,_:String(Date.now())});
      Object.entries(payload).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')params.set(k,String(v));});
      const timer=setTimeout(()=>{cleanup();reject(new Error('CRM request timed out.'));},timeout);
      function cleanup(){clearTimeout(timer);delete window[callback];script.remove();}
      window[callback]=result=>{cleanup();resolve(result);};
      script.onerror=()=>{cleanup();reject(new Error('Could not reach the CRM service.'));};
      script.src=`${url}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  const isBridgeBackend=health=>/direct post bridge/i.test(String(health?.transport||''))||/crm v3/i.test(String(health?.service||''));

  async function detectBackend(force=false){
    if(backendPromise&&!force)return backendPromise;
    backendPromise=(async()=>{
      const urls=[...new Set([cfg.apiUrl,cfg.apiFallbackUrl].filter(Boolean))];
      let lastError;
      for(const url of urls){
        try{
          const health=await jsonpAt(url,'health',{},7000);
          if(health?.ok)return{url,health,bridge:isBridgeBackend(health)};
          lastError=new Error(health?.sheetError||health?.driveError||health?.error||'CRM health check failed.');
        }catch(error){lastError=error;}
      }
      throw lastError||new Error('No CRM deployment is available.');
    })();
    try{return await backendPromise;}catch(error){backendPromise=null;throw error;}
  }

  async function jsonp(action,payload={},timeout=12000){const backend=await detectBackend();return jsonpAt(backend.url,action,payload,timeout);}

  async function get(action,payload={},options={}){
    const session=getSession();
    const request={...payload};
    if(session?.token&&!request.token)request.token=session.token;
    const result=await jsonp(action,request,options.timeout||12000);
    if(!result?.ok)throw new Error(result?.error||'CRM request failed.');
    return result;
  }

  function bridgePostAt(url,action,request,options={}){
    return new Promise((resolve,reject)=>{
      const requestId=request.requestId||makeId();request.requestId=requestId;
      const iframe=document.createElement('iframe');
      iframe.name=`tfc_bridge_${requestId.replace(/[^a-zA-Z0-9]/g,'')}`;
      iframe.setAttribute('aria-hidden','true');iframe.style.cssText='display:none!important;width:0;height:0;border:0;';document.body.appendChild(iframe);
      const form=document.createElement('form');form.method='POST';form.action=url;form.target=iframe.name;form.style.display='none';
      const bridge=document.createElement('input');bridge.type='hidden';bridge.name='bridge';bridge.value='1';form.appendChild(bridge);
      const id=document.createElement('input');id.type='hidden';id.name='requestId';id.value=requestId;form.appendChild(id);
      const data=document.createElement('textarea');data.name='payload';data.value=JSON.stringify(request);form.appendChild(data);document.body.appendChild(form);
      const timeout=options.timeout||(action==='uploadDocument'?65000:25000);
      const timer=setTimeout(()=>{cleanup();reject(new Error('CRM bridge timed out.'));},timeout);
      function cleanup(){clearTimeout(timer);window.removeEventListener('message',onMessage);form.remove();setTimeout(()=>iframe.remove(),0);}
      function onMessage(event){
        if(event.source!==iframe.contentWindow)return;
        const message=event.data;
        if(!message||message.channel!==BRIDGE_CHANNEL||message.requestId!==requestId)return;
        cleanup();
        const result=message.result;
        if(!result?.ok)return reject(new Error(result?.error||'CRM operation failed.'));
        resolve(result);
      }
      window.addEventListener('message',onMessage);form.submit();
    });
  }

  async function legacyUploadAt(url,request,options={}){
    const requestId=request.requestId||makeId();request.requestId=requestId;
    const body=JSON.stringify(request);
    fetch(url,{method:'POST',mode:'no-cors',cache:'no-store',redirect:'follow',headers:{'Content-Type':'text/plain;charset=UTF-8'},body}).catch(()=>null);
    const timeout=options.timeout||65000,started=Date.now();let delay=500;
    while(Date.now()-started<timeout){
      await sleep(delay);
      try{
        const result=await jsonpAt(url,'operationResult',{requestId},7000);
        if(result?.pending){delay=Math.min(1600,Math.round(delay*1.3));continue;}
        if(!result?.ok)throw new Error(result?.error||'Upload failed.');
        return result;
      }catch(error){if(/invalid|unauthorized|expired|operation failed/i.test(error.message||''))throw error;delay=Math.min(1600,Math.round(delay*1.3));}
    }
    throw new Error('The upload is still processing. Refresh your dashboard before uploading the same file again.');
  }

  function adminUpdateMatches(data,payload){return['status','advisor','messageTitle','messageBody','approvedAmount','quote','notes'].every(f=>normalize(data?.[f])===normalize(payload?.[f]));}

  async function recoverWrite(action,payload){
    try{
      if(action==='adminUpdate'){
        const result=await get('getClient',{applicationId:payload.applicationId},{timeout:9000});
        return adminUpdateMatches(result.data,payload)?{ok:true,data:result.data,recovered:true}:null;
      }
      if(action==='adminEnsureDrive'){
        const result=await get('getClient',{applicationId:payload.applicationId},{timeout:9000});
        return result.data?.driveUrl?{ok:true,data:result.data,recovered:true}:null;
      }
      if(action==='clientConfirmSignature'){
        const result=await get('getClient',{applicationId:payload.applicationId},{timeout:9000});
        const yes=result.data?.signatureConfirmed===true||String(result.data?.signatureConfirmed).toLowerCase()==='true';
        return yes?{ok:true,data:result.data,recovered:true}:null;
      }
    }catch(_){}
    return null;
  }

  async function directWrite(backend,action,request,timeout=15000){
    const result=await jsonpAt(backend.url,action,request,timeout);
    if(!result?.ok)throw new Error(result?.error||'CRM operation failed.');
    return result;
  }

  async function post(action,payload={},options={}){
    const backend=await detectBackend();
    const session=getSession();
    const request={action,requestId:makeId(),...(session?.token?{token:session.token}:{}),...payload};

    // Older deployments expose the same actions through doGet. Use that path
    // immediately for small requests so there is no polling delay. Large PDF
    // payloads remain POST-only until the v3 bridge deployment is active.
    if(!backend.bridge&&action!=='uploadDocument')return directWrite(backend,action,request,options.timeout||15000);
    if(!backend.bridge&&action==='uploadDocument')return legacyUploadAt(backend.url,request,options);

    try{return await bridgePostAt(backend.url,action,request,options);}
    catch(error){
      const recovered=await recoverWrite(action,payload);
      if(recovered)return recovered;
      if(action!=='uploadDocument')return directWrite(backend,action,request,options.timeout||15000);
      throw error;
    }
  }

  async function createAccount(payload){
    try{
      const result=await post('createAccount',payload,{timeout:25000});setSession(result.session);return result;
    }catch(error){
      // A lost create response is recovered by logging into the account that was
      // just created, avoiding duplicate client records.
      try{
        const backend=await detectBackend();
        const result=await directWrite(backend,'clientLogin',{email:payload.email,password:payload.password},12000);
        setSession(result.session);return result;
      }catch(_){throw error;}
    }
  }
  async function clientLogin(email,password){const result=await post('clientLogin',{email,password},{timeout:20000});setSession(result.session);return result;}
  async function adminLogin(email,password){const result=await post('adminLogin',{email,password},{timeout:20000});setSession(result.session);return result;}
  async function health(force=false){return(await detectBackend(force)).health;}

  window.TFC_CRM=Object.freeze({get,post,jsonp,health,createAccount,clientLogin,adminLogin,getSession,setSession,clearSession,logout:clearSession});
})();