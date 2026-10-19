'use strict';
const fs = require('node:fs'), path = require('node:path');
const { FiltersEngine } = require('@ghostery/adblocker');
(async () => {
  const urls = ['https://easylist.to/easylist/easylist.txt','https://easylist.to/easylist/easyprivacy.txt'];
  const dir = path.resolve(__dirname,'../assets/filters'); fs.mkdirSync(dir,{recursive:true});
  const texts = [];
  for (const url of urls) {
    const local = path.join(dir,new URL(url).pathname.split('/').pop());
    // --local makes rebuilding deterministic and avoids a network dependency.
    const response = process.argv.includes('--local') ? null : await fetch(url,{signal:AbortSignal.timeout(45000)});
    if (response && !response.ok) throw Error(url + ': ' + response.status);
    const text = response ? await response.text() : fs.readFileSync(local,'utf8'); if (!text.includes('[Adblock Plus') || text.length < 100000) throw Error('Invalid filter list');
    texts.push(text); fs.writeFileSync(path.join(dir,new URL(url).pathname.split('/').pop()),text);
  }
  const engine = FiltersEngine.parse(texts.join('\n'),{enableCompression:true}); fs.writeFileSync(path.join(dir,'engine.bin'),engine.serialize());
  fs.writeFileSync(path.join(dir,'sources.json'),JSON.stringify({sources:urls,checkedAt:new Date().toISOString(),license:'See the license and upstream references in each bundled filter list.'},null,2));
  console.log(JSON.stringify({bytes:fs.statSync(path.join(dir,'engine.bin')).size,lists:urls.length}));
})().catch(error => { console.error(error); process.exitCode=1; });
