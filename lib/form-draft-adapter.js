(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SCFormDraftAdapter=factory();})(typeof window==='undefined'?this:window,function(){
'use strict';
// Capture raw controls rather than collectForm(): an incomplete form is a valid
// draft, and zero/blank values must retain their exact meaning.
function controls(form){return [...form.querySelectorAll('input,select,textarea')].filter(n=>!['file','password','button','submit'].includes(n.type));}
function identity(n){return [n.tagName,n.type||'',n.id||'',n.name||''].join(':');}
function capture(form,state){
  const fields=controls(form).map(n=>({identity:identity(n),value:n.value,checked:Boolean(n.checked)}));
  return {version:1,fields,state:structuredClone(state)};
}
function validate(form,payload){
  const nodes=controls(form);
  if(payload?.version!==1||!Array.isArray(payload.fields)||payload.fields.length!==nodes.length||!payload.state||typeof payload.state!=='object')throw Error('O formulário mudou. Preserve o rascunho para conferência.');
  payload.fields.forEach((f,i)=>{if(f.identity!==identity(nodes[i])||typeof f.value!=='string'||typeof f.checked!=='boolean')throw Error('Campos do rascunho incompatíveis.');});
  const s=payload.state;
  if(!Number.isInteger(s.step)||s.step<1||s.step>6||!Array.isArray(s.photos)||typeof s.signature!=='string'||typeof s.signatureAt!=='string')throw Error('Estado do rascunho inválido.');
  return nodes;
}
function restore(form,payload){
  const nodes=validate(form,payload);
  // Validate the entire payload and detach state before the first DOM mutation.
  const state=structuredClone(payload.state);
  payload.fields.forEach((f,i)=>{
    const n=nodes[i];
    // A partner option might not yet be loaded; preserve its exact identifier.
    if(n.tagName==='SELECT'&&f.value&&![...n.options].some(o=>o.value===f.value)){
      const option=n.ownerDocument.createElement('option');option.value=f.value;option.textContent='Valor preservado — conferir';n.appendChild(option);
    }
    n.value=f.value;if(['radio','checkbox'].includes(n.type))n.checked=f.checked;
  });
  return state;
}
return {capture,restore,validate};
});
