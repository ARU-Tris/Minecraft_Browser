(() => {
  'use strict';
  const $=selector=>document.querySelector(selector),messages=window.CraftLocales;let language='en';try{language=localStorage.getItem('language')==='ko'?'ko':'en';}catch{}
  const t=(source,values={})=>(language==='ko'?messages[source]||source:source).replace(/\{(\w+)\}/g,(match,key)=>Object.hasOwn(values,key)?values[key]:match);
  function render(){document.documentElement.lang=language;$('#language').value=language;document.querySelectorAll('[data-label]').forEach(node=>node.textContent=t(node.dataset.label));}
  $('#language').onchange=event=>{language=event.target.value;try{localStorage.setItem('language',language);}catch{}render();};
  function flatten(nodes,folder='',result=[]){for(const node of nodes){if(node.url)result.push({title:node.title,url:node.url,folder});if(node.children)flatten(node.children,[folder,node.title].filter(Boolean).join(' / '),result);}return result;}
  $('#transfer').onclick=async()=>{
    const match=$('#code').value.trim().match(/^(\d{1,5})\.([A-Za-z0-9_-]{43})$/);if(!match||Number(match[1])<1||Number(match[1])>65535){$('#status').textContent=t('Enter a valid one-time code from MINECRAFT?.');return;}
    if(!$('#cookies').checked&&!$('#bookmarks').checked)return;
    $('#transfer').disabled=true;$('#status').textContent=t('Transferring…');
    try{
      const cookies=[];
      if($('#cookies').checked){const normal=await chrome.cookies.getAll({});let partitioned=[];try{partitioned=await chrome.cookies.getAll({partitionKey:{}});}catch{}const seen=new Set();for(const value of [...normal,...partitioned]){const key=JSON.stringify([value.storeId,value.domain,value.path,value.name,value.partitionKey]);if(!seen.has(key)){seen.add(key);cookies.push(value);}}}
      const bookmarks=$('#bookmarks').checked?flatten(await chrome.bookmarks.getTree()):[];
      const response=await fetch(`http://127.0.0.1:${Number(match[1])}/transfer`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+match[2]},body:JSON.stringify({cookies,bookmarks}),signal:AbortSignal.timeout(120000)});
      if(!response.ok)throw Error();const result=await response.json();$('#code').value='';
      $('#status').textContent=t('Transferred {cookies} cookies and {bookmarks} bookmarks.',{cookies:result.imported,bookmarks:result.bookmarks})+'\n'+t('{count} cookies were kept, skipped or unavailable.',{count:result.existing+result.expired+result.partitioned+result.invalid+result.failed});
    }catch{$('#status').textContent=t('Transfer did not finish. Check the result in MINECRAFT? and start a new transfer if needed.');}
    finally{$('#transfer').disabled=false;}
  };
  render();
})();
