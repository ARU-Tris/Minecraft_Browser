'use strict';
const fs=require('node:fs'),path=require('node:path');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run({win,command,app,output}){
  const read=code=>win.webContents.executeJavaScript(code);fs.mkdirSync(output,{recursive:true});
  for(let i=0;i<450;i++){if(await read("document.querySelector('#browser-shell').dataset.resourcePacks==='1'&&document.querySelector('#pane-left canvas[data-player-canvas]')?.dataset.ready==='true'"))break;await delay(100);}
  await delay(500);
  await read("window.__perf={canvasCreates:0,draws:0,tabMutations:0,longTasks:0,longTaskMs:0};const create=document.createElement.bind(document);document.createElement=function(name,...rest){if(name==='canvas')__perf.canvasCreates++;return create(name,...rest)};const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...args){__perf.draws++;return draw.apply(this,args)};new MutationObserver(records=>{__perf.tabMutations+=records.length}).observe(document.querySelector('#tab-list'),{childList:true,subtree:true});new PerformanceObserver(list=>{for(const e of list.getEntries()){__perf.longTasks++;__perf.longTaskMs+=e.duration;}}).observe({type:'longtask',buffered:false});");
  for(let i=0;i<50;i++)await command('focus',{side:'left'});await delay(300);
  const duplicate=await read('({...__perf})');
  await read('Object.assign(__perf,{canvasCreates:0,draws:0,tabMutations:0,longTasks:0,longTaskMs:0})');
  const box=await read("(()=>{const r=document.querySelector('#pane-left .player-well').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()");
  const samples=[];
  for(let i=0;i<60;i++){win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(box.x+box.width/2+Math.sin(i/10)*box.width*2),y:Math.round(box.y+box.height/2+Math.cos(i/10)*box.height/2)});await delay(16);if(i%15===0)samples.push(app.getAppMetrics().reduce((sum,p)=>sum+p.cpu.percentCPUUsage,0));}
  await delay(700);const tracking=await read('({...__perf})');
  const report={version:app.getVersion(),passed:1,duplicateUpdates:50,duplicate,trackingPointerMoves:60,tracking,cpuSamples:samples};
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
module.exports={run};
