'use strict';
const http=require('node:http'),crypto=require('node:crypto'),M=require('./migration-model.cjs');
function create({session,importBookmarks,onState=()=>{},timeout=10*60*1000}){
  let server,timer,current={status:'idle'},accepting=false,generation=0;
  const emit=value=>{current=value;onState({...current});};
  function stop(){generation++;clearTimeout(timer);const old=server;server=null;accepting=false;if(old){old.close();old.closeIdleConnections?.();}if(['waiting','transferring'].includes(current.status))emit({status:'cancelled'});}
  async function start({replaceExisting=false}={}){
    if(current.status==='transferring')throw Error('A transfer is already running.');stop();const ticket=generation,token=crypto.randomBytes(32).toString('base64url'),expiresAt=Date.now()+timeout;
    const active=http.createServer(async(request,response)=>{
      const origin=request.headers.origin,extension=!origin||/^chrome-extension:\/\/[a-p]{32}$/.test(origin);
      if(!extension||request.headers.host!==`127.0.0.1:${active.address()?.port}`){response.writeHead(403).end();return;}
      if(origin)response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Cache-Control','no-store');
      if(request.method==='OPTIONS'){response.setHeader('Access-Control-Allow-Methods','POST');response.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');response.setHeader('Access-Control-Allow-Private-Network','true');response.writeHead(204).end();return;}
      const provided=Buffer.from(request.headers.authorization||''),expected=Buffer.from('Bearer '+token);
      if(provided.length!==expected.length||!crypto.timingSafeEqual(provided,expected)||!accepting||Date.now()>expiresAt||request.method!=='POST'||request.url!=='/transfer'){response.writeHead(403).end();return;}
      if(!String(request.headers['content-type']||'').startsWith('application/json')){response.writeHead(415).end();return;}
      let size=0,chunks=[],result;
      try{for await(const chunk of request){size+=chunk.length;if(size>24*1024*1024){response.writeHead(413).end();request.destroy();return;}chunks.push(chunk);}const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));chunks=[];
        if(!Array.isArray(body.cookies)||body.cookies.length>50000||body.bookmarks!==undefined&&!Array.isArray(body.bookmarks)){response.writeHead(400).end();return;}
        if(!accepting){response.writeHead(409).end();return;}accepting=false;clearTimeout(timer);emit({status:'transferring'});
        result={imported:0,existing:0,expired:0,partitioned:0,invalid:0,failed:0,bookmarks:0,bookmarksSkipped:0};
        const existing=new Set((await session.cookies.get({})).map(value=>[value.domain.replace(/^\./,'').toLowerCase(),value.path,value.name].join('\0')));
        for(const value of body.cookies){if(ticket!==generation)throw Error();const normalized=M.cookie(value);if(!normalized.details){result[normalized.reason]++;continue;}if(existing.has(normalized.key)&&!replaceExisting){result.existing++;continue;}try{await session.cookies.set(normalized.details);existing.add(normalized.key);result.imported++;}catch{result.failed++;}}
        await session.cookies.flushStore();if(body.bookmarks?.length){const bookmarks=await importBookmarks(body.bookmarks);result.bookmarks=bookmarks.added;result.bookmarksSkipped=bookmarks.skipped;}
        if(ticket===generation)emit({status:'completed',result});response.setHeader('Content-Type','application/json');response.writeHead(200).end(JSON.stringify(result));active.close();if(server===active)server=null;
      }catch{if(!response.headersSent)response.writeHead(400).end(JSON.stringify({error:'Transfer failed. Check the result in the app.',result}));if(ticket===generation){accepting=false;clearTimeout(timer);emit({status:'failed',result});}active.close();if(server===active)server=null;}
    });
    active.maxRequestsPerSocket=4;active.requestTimeout=120000;active.headersTimeout=10000;active.on('clientError',(_error,socket)=>socket.destroy());
    await new Promise((resolve,reject)=>{active.once('error',reject);active.listen(0,'127.0.0.1',resolve);});if(ticket!==generation){active.close();throw Error('Transfer cancelled.');}server=active;accepting=true;
    emit({status:'waiting',code:active.address().port+'.'+token,expiresAt});timer=setTimeout(()=>{stop();emit({status:'expired'});},timeout);timer.unref?.();return {...current};
  }
  return {start,stop,state:()=>({...current})};
}
module.exports={create};
