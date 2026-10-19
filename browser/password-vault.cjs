'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),M=require('./migration-model.cjs');
function create(file,storage,{maxBytes=32*1024*1024}={}){
  let cached,pending=Promise.resolve();const serial=run=>{const result=pending.then(run);pending=result.catch(()=>{});return result;};
  async function available(){if(!(await storage.isAsyncEncryptionAvailable()))throw Error('Windows password encryption is unavailable. Nothing was imported.');}
  async function load(){
    if(cached)return cached;await available();let bytes;try{bytes=await fs.readFile(file);}catch(error){if(error.code==='ENOENT')return cached={schema:1,passwords:[],bookmarks:[]};throw Error('Could not open imported data. Your existing file was kept.');}
    if(bytes.length>40*1024*1024)throw Error('Could not open imported data. Your existing file was kept.');
    try{const decoded=await storage.decryptStringAsync(bytes),data=JSON.parse(decoded.result);if(data.schema!==1||!Array.isArray(data.passwords)||!Array.isArray(data.bookmarks))throw Error();return cached=data;}catch{throw Error('Could not open imported data. Your existing file was kept.');}
  }
  async function save(next){const text=JSON.stringify(next);if(Buffer.byteLength(text)>maxBytes)throw Error('Imported data exceeds the storage limit. Your previous data was kept.');await available();const bytes=await storage.encryptStringAsync(text);const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(path.dirname(file),{recursive:true});try{await fs.writeFile(temp,bytes,{mode:0o600,flag:'wx'});await fs.rename(temp,file);cached=next;}catch{await fs.unlink(temp).catch(()=>{});throw Error('Could not save imported data. Your previous data was kept.');}}
  return {
    info:()=>serial(async()=>{const state=await load();return {passwords:state.passwords.length,bookmarks:state.bookmarks.length};}),
    importPasswords:text=>serial(async()=>{const incoming=M.passwords(text),state=await load(),seen=new Set(state.passwords.map(value=>value.id)),added=incoming.records.filter(value=>!seen.has(value.id));if(added.length+state.passwords.length>50000)throw Error('This CSV has too many passwords.');if(added.length)await save({...state,passwords:[...state.passwords,...added]});return {added:added.length,skipped:incoming.skipped+incoming.records.length-added.length};}),
    importBookmarks:values=>serial(async()=>{const incoming=M.bookmarks(values),state=await load(),seen=new Set(state.bookmarks.map(value=>value.id)),added=incoming.records.filter(value=>!seen.has(value.id));if(added.length+state.bookmarks.length>50000)throw Error('Too many Chrome bookmarks.');if(added.length)await save({...state,bookmarks:[...state.bookmarks,...added]});return {added:added.length,skipped:incoming.skipped+incoming.records.length-added.length};}),
    list:(kind,query='',origin='')=>serial(async()=>{const state=await load(),text=String(query).slice(0,200).toLowerCase(),source=kind==='passwords'?state.passwords:state.bookmarks;let records=source.filter(value=>[value.name,value.title,value.username,value.origin,value.url,value.folder].filter(Boolean).some(field=>field.toLowerCase().includes(text)));if(kind==='passwords')records=records.sort((a,b)=>Number(b.origin===origin)-Number(a.origin===origin));return {total:source.length,matches:records.length,entries:records.slice(0,100).map(({password,note,...value})=>({...value,canFill:kind==='passwords'&&value.origin===origin}))};}),
    credential:(id,origin)=>serial(async()=>{const state=await load(),record=state.passwords.find(value=>value.id===id&&value.origin===origin);if(!record)throw Error('Open the matching website before filling this password.');return {...record};})
  };
}
module.exports={create};
