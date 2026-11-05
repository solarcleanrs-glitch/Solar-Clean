(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SCOperationalAccess=factory();})(typeof window==='undefined'?this:window,function(){
'use strict';
const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co';
const CAPS=['agenda_read','agenda_manage','reports_read','visits_write','crm','finance','admin','clients_read','access_admin'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function validate(data,actor){
 if(!data||data.version!==1||data.actor!==actor||!UUID.test(actor)||!['gestor','gestor_unidade','tecnico','parceiro','financeiro'].includes(data.role)
 ||!/^[a-f0-9]{32}$/.test(data.revision||'')||!Array.isArray(data.units)||data.units.some(u=>!['RS','SC'].includes(u))||new Set(data.units).size!==data.units.length
 ||!data.capabilities||CAPS.some(k=>typeof data.capabilities[k]!=='boolean'))throw Error('Resposta de acesso inválida. Confira a sessão.');
 const c=data.capabilities;
 // Reject a malformed response that accidentally grants administrative paths
 // to field users. Real data authorization still runs on the server.
 if(!['gestor','gestor_unidade'].includes(data.role)&&['agenda_manage','crm','finance','admin','access_admin'].some(k=>c[k]))throw Error('Permissões incompatíveis com o perfil.');
 if(!['gestor','gestor_unidade','tecnico'].includes(data.role)&&c.visits_write)throw Error('Escrita técnica incompatível com o perfil.');
 if(data.role!=='gestor'&&c.access_admin||data.role==='tecnico'&&c.clients_read||data.units.length===0&&CAPS.some(k=>c[k]))throw Error('Permissões incompatíveis com as unidades.');
 return Object.freeze({version:1,actor,role:data.role,revision:data.revision,units:Object.freeze([...data.units]),capabilities:Object.freeze(Object.fromEntries(CAPS.map(k=>[k,c[k]])))});
}
function create({context,fetch:request,now=Date.now}){
 let value=null,key='',expires=0,generation=0,pending=null;
 const fingerprint=()=>{const c=context();return JSON.stringify([c?.project,c?.actor,c?.generation,c?.headers?.Authorization]);};
 function clear(){generation++;value=null;key='';expires=0;pending=null;}
 function current(){return value&&key===fingerprint()&&now()<expires?value:null;}
 function allows(cap,unit=null){const p=current();return Boolean(p&&CAPS.includes(cap)&&p.capabilities[cap]&&(unit===null||p.units.includes(unit)));}
 async function refresh(){
  const before=fingerprint();if(pending?.key===before)return pending.promise;
  const c=context(),turn=++generation;if(!current()){value=null;expires=0;}
  const check=()=>{if(turn!==generation||before!==fingerprint())throw Error('A sessão mudou durante a consulta de acesso.');};
  const promise=(async()=>{
   if(c?.project!==PROJECT||!UUID.test(c.actor||''))throw Error('Entre na conta do projeto de testes.');
   const response=await request(PROJECT+'/rest/v1/rpc/sc_acesso_operacional',{method:'POST',headers:{...c.headers,'Content-Type':'application/json'},body:'{}',...(typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'?{signal:AbortSignal.timeout(15000)}:{})});check();
   if(!response.ok)throw Error('Acesso não confirmado (HTTP '+response.status+'). Conecte e confira sua conta.');
   const data=validate(await response.json(),c.actor);check();value=data;key=before;expires=now()+60000;return data;
  })();pending={key:before,promise};try{return await promise;}catch(error){if(turn===generation){value=null;expires=0;}throw error;}finally{if(pending?.promise===promise)pending=null;}
 }
 return Object.freeze({refresh,current,allows,clear});
}
return {create,validate,CAPS,PROJECT};
});
