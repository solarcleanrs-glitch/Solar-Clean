function bootstrap(seed){
 const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co',MODE='solarCleanScopedOperationalEnabled:v1:zzphucuiqhzrilrddxnf',PREFIX='solarCleanScopedOperational:v1:zzphucuiqhzrilrddxnf:';
 const jwt=actor=>'synthetic.'+btoa(JSON.stringify({sub:actor,exp:Math.floor(Date.now()/1000)+86400}))+'.not-a-real-token';
 const values=new Map([[MODE,'1'],['solarCleanAccessToken',jwt(seed.actors.A)],['solarCleanRefreshToken','synthetic-refresh-A'],['solarCleanTech',JSON.stringify({name:'Conta sintética A',email:'a@example.invalid',cloud:true,signature:''})],['solarCleanCompany',JSON.stringify({empresa:'TESTE SINTÉTICO — NÃO É PRODUÇÃO',supabaseUrl:PROJECT,supabaseKey:'synthetic-public-key-not-valid'})]]);
 if(seed.noActivation)values.delete(MODE);
 const memory={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(k),clear:()=>values.clear()};
 Object.defineProperty(window,'localStorage',{value:memory,configurable:false});
 Object.defineProperty(navigator,'onLine',{value:false,configurable:false});
 const nativeDB=window.indexedDB,allowed=new Set(Object.values(seed.actors).map(id=>PREFIX+id));
 const allowedName=name=>allowed.has(name)||[...allowed].some(base=>name.startsWith(base+':access:')&&/^[a-f0-9]{32}$/.test(name.slice((base+':access:').length)));
 Object.defineProperty(window,'indexedDB',{value:{open(name,version){if(!allowedName(name))throw Error('Base fora do ensaio bloqueada: '+name);return nativeDB.open(name,version);},async databases(){return (await nativeDB.databases()).filter(d=>allowedName(d.name));},deleteDatabase(){throw Error('Exclusão bloqueada no ensaio.');}},configurable:false});
 window.fetch=async(url,options={})=>{
  if(String(url)===PROJECT+'/rest/v1/rpc/sc_acesso_operacional'){
   const actor=JSON.parse(atob((values.get('solarCleanAccessToken')||'').split('.')[1]||'e30=')).sub;
   const which=actor===seed.actors.A?'A':actor===seed.actors.B?'B':null;
   if(!which)return new Response('Synthetic denied',{status:403});
   const role=seed.roles?.[which]||'gestor',manager=['gestor','gestor_unidade'].includes(role),units=role==='gestor'?['RS','SC']:['RS'];
   return new Response(JSON.stringify({version:1,actor,role,units,revision:(role==='gestor'?'1':'2').repeat(32),capabilities:{agenda_read:true,agenda_manage:manager,reports_read:true,visits_write:manager,crm:manager,finance:manager,admin:manager,clients_read:role!=='tecnico',access_admin:role==='gestor'}}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(String(url)===PROJECT+'/auth/v1/token?grant_type=password'){
   const body=JSON.parse(options.body||'{}'),which=body.email==='a@example.invalid'?'A':body.email==='b@example.invalid'?'B':null;
   if(!which)return new Response('Conta fictícia inválida',{status:401});
   return new Response(JSON.stringify({access_token:jwt(seed.actors[which]),refresh_token:'synthetic-refresh-'+which}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  throw Error('Rede desativada neste ensaio sintético.');
 };
 window.confirm=()=>true;
 window.alert=message=>parent.postMessage({type:'solar-clean-synthetic-alert',fixtureId:seed.fixtureId,message:String(message)},location.origin);
 window.addEventListener('unhandledrejection',event=>parent.postMessage({type:'solar-clean-synthetic-error',fixtureId:seed.fixtureId,message:String(event.reason?.message||event.reason)},location.origin));
}
