'use strict';
const crypto=require('node:crypto');
const id=text=>crypto.createHash('sha256').update(text).digest('hex');
function url(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u:null;}catch{return null;}}
function csv(text){
  if(typeof text!=='string'||Buffer.byteLength(text)>16*1024*1024)throw Error('Choose a password CSV smaller than 16 MB.');
  text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
  const cell=()=>{row.push(field);field='';closed=false;};const line=()=>{cell();if(row.some(value=>value!==''))rows.push(row);row=[];if(rows.length>50001)throw Error('This CSV has too many passwords.');};
  for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
    else if(c===',')cell();else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;line();}else if(c==='"'&&!field&&!closed)quoted=true;else{if(closed)throw Error('The password CSV format is invalid.');field+=c;}}
  if(quoted)throw Error('The password CSV format is invalid.');if(field||row.length||closed)line();return rows;
}
function passwords(text){
  const rows=csv(text),header=rows.shift()?.map(value=>value.trim().toLowerCase())||[],column=name=>header.indexOf(name);
  if(['url','username','password'].some(name=>column(name)<0))throw Error('Choose a Chrome password export with URL, username and password columns.');
  const records=[],seen=new Set();let skipped=0;
  for(const row of rows){const site=url(row[column('url')]),username=row[column('username')],password=row[column('password')];
    if(!site||typeof username!=='string'||typeof password!=='string'||!password||username.length>4096||password.length>16384){skipped++;continue;}
    const key=id(site.origin+'\0'+username);if(seen.has(key)){skipped++;continue;}seen.add(key);
    records.push({id:key,origin:site.origin,username,password,name:String(row[column('name')]||site.hostname).slice(0,300),note:String(row[column('note')]||'').slice(0,16384)});
  }return {records,skipped};
}
function cookie(value,now=Date.now()/1000){
  if(!value||typeof value!=='object')return {reason:'invalid'};
  if(value.partitionKey)return {reason:'partitioned'};
  const domain=typeof value.domain==='string'?value.domain:'',host=domain.replace(/^\./,'');
  if(!host||host.length>253||/[\s/\\@:?#\x00-\x1f]/.test(host)||host.includes('..')||host.endsWith('.'))return {reason:'invalid'};
  const site=url((value.secure?'https://':'http://')+host+'/');if(!site||site.hostname!==host.toLowerCase())return {reason:'invalid'};
  if(typeof value.name!=='string'||typeof value.value!=='string'||value.name.length>1024||value.value.length>16384||/[\x00-\x20;=,\x7f]/.test(value.name)||/[\x00-\x1f\x7f]/.test(value.value))return {reason:'invalid'};
  if(value.expirationDate!==undefined&&(!Number.isFinite(value.expirationDate)||value.expirationDate<=now))return {reason:'expired'};
  const path=typeof value.path==='string'&&value.path.startsWith('/')?value.path:'/';if(path.length>4096||/[\x00-\x1f\x7f]/.test(path))return {reason:'invalid'};
  const result={url:site.href,name:value.name,value:value.value,path,secure:value.secure===true,httpOnly:value.httpOnly===true,sameSite:['strict','lax','no_restriction','unspecified'].includes(value.sameSite)?value.sameSite:'unspecified'};
  if(value.hostOnly!==true)result.domain=domain;if(value.session!==true&&value.expirationDate!==undefined)result.expirationDate=value.expirationDate;
  return {details:result,key:[domain.replace(/^\./,'').toLowerCase(),path,value.name].join('\0')};
}
function bookmarks(values){
  if(!Array.isArray(values)||values.length>50000)throw Error('Too many Chrome bookmarks.');const records=[],seen=new Set();let skipped=0;
  for(const value of values){const site=url(value?.url);if(!site||site.href.length>8192){skipped++;continue;}const key=id(site.href);if(seen.has(key)){skipped++;continue;}seen.add(key);records.push({id:key,url:site.href,title:String(value.title||site.hostname).slice(0,500),folder:String(value.folder||'').slice(0,1500)});}
  return {records,skipped};
}
module.exports={csv,passwords,cookie,bookmarks,url};
