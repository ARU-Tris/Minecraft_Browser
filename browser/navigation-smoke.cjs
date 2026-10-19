'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(run,label,timeout=30000){const start=Date.now();while(Date.now()-start<timeout){if(await run())return;await delay(100);}throw Error('Timed out: '+label);}
async function run({win,tabs,views,snapshot,app,output}){
  const checks=[],errors=[],report={version:app.getVersion(),checks,errors,externalPages:[]};fs.mkdirSync(output,{recursive:true});
  const read=code=>win.webContents.executeJavaScript(code);
  win.webContents.on('console-message',(_event,details)=>{if(details?.level==='error')errors.push(details.message);});
  const check=async(name,test)=>{try{await test();checks.push({name,passed:true});console.log('PASS '+name);}catch(error){checks.push({name,passed:false,error:error.message});throw error;}};
  async function click(selector){
    const rect=await read(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing element');const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
    win.webContents.focus();win.webContents.sendInputEvent({type:'mouseMove',...rect});win.webContents.sendInputEvent({type:'mouseDown',...rect,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...rect,button:'left',clickCount:1});await delay(250);
  }
  async function key(keyCode,modifiers=[]){win.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});if(keyCode==='Return')win.webContents.sendInputEvent({type:'char',keyCode:'\r'});win.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});await delay(100);}
  async function type(selector,text){await click(selector);await key('A',['control']);await win.webContents.insertText(text);}
  async function home(){await click('#open-address');await until(()=>read("document.querySelector('#address-dialog').open"),'address dialog');await click('button.command-choice[data-scene=home]');await until(()=>tabs.active().url==='craftside://inventory','home choice');}
  async function website(host,label){
    await until(async()=>{const tab=tabs.active(),wc=views.get(tab.id)?.webContents;if(!wc||!tab.url.startsWith('https://')||!new URL(tab.url).hostname.endsWith(host)||tab.error)return false;return wc.executeJavaScript("document.readyState!=='loading'&&!!document.body&&document.body.innerText.length>40").catch(()=>false);},label,45000);
    await until(()=>views.get(tabs.active().id)?.getVisible(),'website is visible');
    const tab=tabs.active(),wc=views.get(tab.id).webContents;assert.equal(tab.error,'');
    report.externalPages.push({requested:label,url:wc.getURL(),title:wc.getTitle(),visible:views.get(tab.id).getVisible()});
    return wc;
  }
  async function screenshot(wc,name){let error;for(let i=0;i<20;i++){try{fs.writeFileSync(path.join(output,name),(await wc.capturePage()).toPNG());return;}catch(e){error=e;await delay(100);}}throw error;}
  try{
    await until(()=>read("document.querySelectorAll('#pane-left .bookmark-slot').length===36"),'inventory');
    await check('Inventory compass click keeps address dialog open',async()=>{await click('#pane-left [data-action=address]');assert.equal(await read("document.querySelector('#address-dialog').open"),true);});
    await click('#close-address');
    await check('Fixed bookmark tool opens a persistent library dialog',async()=>{await click('#pane-left button[data-panel=bookmarks]');assert.equal(await read("document.querySelector('#storage-dialog').open"),true);});
    await click('#close-storage');
    await check('Fixed barrier tool keeps ad options open',async()=>{await click('#pane-left [data-action=shield]');assert.equal(await read("document.querySelector('#shield-popover').hidden"),false);});
    await click('[data-close-popover]');
    await check('Crafting-table add-site dialog stays open',async()=>{await click('#pane-left [data-new-bookmark]');assert.equal(await read("document.querySelector('#bookmark-dialog').open"),true);});
    await key('Escape');
    await check('Clicking an empty slot keeps the site editor open',async()=>{await click('#pane-left [data-bookmark-slot="5"]');assert.equal(await read("document.querySelector('#bookmark-dialog').open"),true);});
    await key('Escape');
    await check('Inventory GitHub bookmark opens an actual HTTPS website',async()=>{await click('#pane-left [data-bookmark-id="bookmark-github"]');const wc=await website('github.com','GitHub bookmark click');await screenshot(wc,'01-github-page.png');});
    await check('Sidebar address remains usable after opening a website',async()=>{await click('#open-address');assert.equal(await read("document.querySelector('#address-dialog').open"),true);assert.ok((await read("document.querySelector('#command-input').value")).includes('github.com'));});
    await check('Typing an external address and pressing Enter opens it',async()=>{await type('#command-input','https://example.com/');await key('Return');const wc=await website('example.com','Address Enter');assert.match(wc.getTitle(),/Example Domain/);});
    await home();
    await check('Returning home restores the same inventory',async()=>assert.equal(await read("document.querySelectorAll('#pane-left .bookmark-slot').length"),36));
    await check('Home search button opens Google results for the entered query',async()=>{await type('#pane-left [data-role=home-query]','Minecraft redstone');await click('#pane-left [data-role=home-search] button[type=submit]');const wc=await website('google.com','Home search button');assert.equal(new URL(wc.getURL()).searchParams.get('q'),'Minecraft redstone');await until(()=>wc.executeJavaScript("!!document.querySelector('#search,#rso')"),'Google results rendered',15000);await screenshot(wc,'02-google-search.png');report.search=await wc.executeJavaScript("({title:document.title,results:!!document.querySelector('#search,#rso'),challenge:/unusual traffic|자동화된 쿼리|비정상적인 트래픽/i.test(document.body.innerText)})");assert.equal(report.search.results,true);assert.equal(report.search.challenge,false);});
    await home();
    await check('Pressing Enter in home search opens a second query',async()=>{await type('#pane-left [data-role=home-query]','Minecraft resource packs');await key('Return');const wc=await website('google.com','Home search Enter');assert.equal(new URL(wc.getURL()).searchParams.get('q'),'Minecraft resource packs');});
    await home();
    await check('NAVER inventory bookmark is not redirected back home',async()=>{await click('#pane-left [data-bookmark-id="bookmark-naver"]');await website('naver.com','NAVER bookmark click');});
    await home();
    await check('Clicking the inventory background leaves the current tab unchanged',async()=>{const before=tabs.active().id;await click('#pane-left .inventory-brand');assert.equal(tabs.active().id,before);assert.equal(tabs.active().url,'craftside://inventory');});
    await check('No app UI errors occurred along the actual click and submit paths',async()=>assert.deepEqual(errors,[]));
    report.passed=checks.length;
  }catch(error){report.failure=error.message;throw error;}
  finally{report.state=snapshot();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(output,'ui.png'),(await win.webContents.capturePage()).toPNG());console.log(JSON.stringify({passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,output}));}
}
module.exports={run};
