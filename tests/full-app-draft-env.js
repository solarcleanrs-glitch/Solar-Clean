function bootstrap(seed){
 const PROJECT='https://zzphucuiqhzrilrddxnf.supabase.co',MODE='solarCleanScopedOperationalEnabled:v1:zzphucuiqhzrilrddxnf',PREFIX='solarCleanScopedOperational:v1:zzphucuiqhzrilrddxnf:';
 const jwt=actor=>'synthetic.'+btoa(JSON.stringify({sub:actor,exp:Math.floor(Date.now()/1000)+86400}))+'.not-a-real-token';
 const values=new Map([[MODE,'1'],['solarCleanAccessToken',jwt(seed.actors.A)],['solarCleanRefreshToken','synthetic-refresh-A'],['solarCleanTech',JSON.stringify({name:'Conta sintética A',email:'a@example.invalid',cloud:true,signature:''})],['solarCleanCompany',JSON.stringify({empresa:'TESTE SINTÉTICO — NÃO É PRODUÇÃO',supabaseUrl:PROJECT,supabaseKey:'synthetic-public-key-not-valid'})]]);
 const memory={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(k),clear:()=>values.clear()};
 Object.defineProperty(window,'localStorage',{value:memory,configurable:false});
 Object.defineProperty(navigator,'onLine',{value:false,configurable:false});
 const nativeDB=window.indexedDB,allowed=new Set(Object.values(seed.actors).map(id=>PREFIX+id));
 Object.defineProperty(window,'indexedDB',{value:{open(name,version){if(!allowed.has(name))throw Error('Base fora do ensaio bloqueada: '+name);return nativeDB.open(name,version);},deleteDatabase(){throw Error('Exclusão bloqueada no ensaio.');}},configurable:false});
 window.fetch=async(url,options={})=>{
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
