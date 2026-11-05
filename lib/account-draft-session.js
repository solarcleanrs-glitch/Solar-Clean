(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./account-draft-vault.js'));else root.SCAccountDraftSession=factory(root.SCAccountDraftVault);})(typeof window==='undefined'?this:window,function(vaultModule){
'use strict';
const {create:makeVault,PROJECT}=vaultModule;
// Orchestrates preservation before authentication changes. UI callbacks are
// injected so failures can be tested without changing any real session.
function create({storage,context,snapshot,clear,restore,randomUUID,quarantine=()=>{}}){
  let open=null;
  function same(owner){const c=context();return c.project===owner.project&&c.actor===owner.actor&&c.generation===owner.generation&&c.accessRevision===owner.accessRevision;}
  function begin(){
    preserve();
    const owner={...context()};
    // Validate ownership before accepting a form, even if it is still empty.
    const vault=makeVault({storage,context:()=>owner}),id=randomUUID();
    vault.read(id);
    if(!same(owner))throw Error('A conta mudou ao abrir o formulário.');
    open={owner,id,vault};return id;
  }
  function preserve(){
    if(!open)return null;
    if(!same(open.owner))throw Error('Volte à conta do formulário antes de continuar.');
    const saved=open.vault.save(open.id,snapshot());
    if(!same(open.owner))throw Error('A conta mudou durante a cópia. Rascunho preservado.');
    return saved;
  }
  function list(){return makeVault({storage,context}).list();}
  function forgetOpen(){open=null;}
  function externalChange(){
    if(!open||same(open.owner))return {changed:false,sameOwner:Boolean(open&&same(open.owner))};
    // The source owner was captured when the form opened. Never classify an
    // old form using the new token observed in another tab.
    try{
      const saved=open.vault.save(open.id,snapshot());
      clear();open=null;return {changed:true,saved};
    }catch(error){
      // Keep the original form in memory. The host must hide it and block
      // navigation rather than show it to the newly selected account.
      quarantine(error);throw error;
    }
  }
  async function transition(changeSession){
    // No token mutation or clearing may precede the durable read-back check.
    const saved=preserve();
    await changeSession();
    clear();open=null;
    return saved;
  }
  function recover(id){
    // Keep the recovered working copy bound to its original owner too. A live
    // context here would make externalChange use the next account's token.
    const owner={...context()},vault=makeVault({storage,context:()=>owner}),saved=vault.read(id);
    if(!saved)throw Error('Rascunho não encontrado nesta conta.');
    if(!same(owner))throw Error('A conta mudou durante a recuperação.');
    // Preserve an already open form before replacing any of its fields.
    preserve();
    restore(saved.payload);
    if(!same(owner))throw Error('A conta mudou durante a recuperação.');
    // A recovery is a new working copy. The original remains available.
    open={owner,id:randomUUID(),vault};return saved.payload;
  }
  return Object.freeze({begin,preserve,transition,recover,list,forgetOpen,externalChange,project:PROJECT});
}
return {create};
});
