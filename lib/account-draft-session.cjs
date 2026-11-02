'use strict';
const {create:makeVault,PROJECT}=require('./account-draft-vault.cjs');
// Orchestrates preservation before authentication changes. UI callbacks are
// injected so failures can be tested without changing any real session.
function create({storage,context,snapshot,clear,restore,randomUUID}){
  let open=null;
  function same(owner){const c=context();return c.project===owner.project&&c.actor===owner.actor&&c.generation===owner.generation;}
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
  async function transition(changeSession){
    // No token mutation or clearing may precede the durable read-back check.
    const saved=preserve();
    await changeSession();
    clear();open=null;
    return saved;
  }
  function recover(id){
    const owner={...context()},vault=makeVault({storage,context}),saved=vault.read(id);
    if(!saved)throw Error('Rascunho não encontrado nesta conta.');
    if(!same(owner))throw Error('A conta mudou durante a recuperação.');
    // Preserve an already open form before replacing any of its fields.
    preserve();
    restore(saved.payload);
    if(!same(owner))throw Error('A conta mudou durante a recuperação.');
    // A recovery is a new working copy. The original remains available.
    open={owner,id:randomUUID(),vault};return saved.payload;
  }
  return Object.freeze({begin,preserve,transition,recover,project:PROJECT});
}
module.exports={create};
