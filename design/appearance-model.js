(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CraftAppearanceModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const key='craftside:appearance:v1',defaults={inventoryScale:150};
  const scale=value=>Math.max(75,Math.min(225,Math.round((Number.isFinite(Number(value))?Number(value):150)/5)*5));
  function read(raw){try{const data=JSON.parse(raw);return {inventoryScale:data&&typeof data.inventoryScale==='number'?scale(data.inventoryScale):150};}catch{return {...defaults};}}
  return {key,defaults,scale,read};
});
