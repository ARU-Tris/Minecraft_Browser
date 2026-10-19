(() => {
  'use strict';
  const M=window.CraftAppearanceModel,shell=document.querySelector('#browser-shell'),slider=document.querySelector('#settings-inventory-size'),output=document.querySelector('#inventory-size-value'),error=document.querySelector('#appearance-error');
  let storage,timer,saved={...M.defaults};try{storage=localStorage;saved=M.read(storage.getItem(M.key));}catch{}
  let current=saved.inventoryScale;
  function apply(value){current=M.scale(value);slider.value=String(current);output.value=output.textContent=current+'%';shell.style.setProperty('--inventory-width',(528*current/100)+'px');shell.dataset.inventoryScale=String(current);document.dispatchEvent(new CustomEvent('craftside:inventory-resized',{detail:{scale:current}}));}
  function save(){clearTimeout(timer);try{if(!storage)throw Error();storage.setItem(M.key,JSON.stringify({inventoryScale:current}));saved.inventoryScale=current;error.hidden=true;}catch{apply(saved.inventoryScale);error.textContent=window.CraftI18n.t('Could not save inventory size. Your previous size was kept.');error.hidden=false;}}
  slider.addEventListener('input',()=>{apply(slider.value);clearTimeout(timer);timer=setTimeout(save,180);});slider.addEventListener('change',save);
  document.querySelector('#reset-inventory-size').onclick=()=>{apply(M.defaults.inventoryScale);save();};
  window.addEventListener('storage',event=>{if(event.key===M.key){saved=M.read(event.newValue);apply(saved.inventoryScale);}});
  window.addEventListener('pagehide',()=>{if(timer)save();});
  apply(current);window.CraftAppearance={get scale(){return current;}};
})();
