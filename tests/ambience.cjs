const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Model = require('../design/ambience-model.js');
const Inventory = require('../design/inventory-model.js');
const assets = require('../assets/ambience/manifest.json');
const catalog = require('../assets/minecraft/catalog.json').items;
const checks = [];
function check(name, action) { action(); checks.push({ name, passed: true }); }
const date = (hour, minute = 0, day = 19) => new Date(2026, 9, day, hour, minute);
check('All eight local-clock boundaries select the requested world', () => {
  for (const [hour, minute, period] of [[0,0,'cave'],[5,59,'cave'],[6,0,'day'],[17,59,'day'],[18,0,'sunset'],[19,59,'sunset'],[20,0,'night'],[23,59,'night']]) assert.equal(Model.schedule(date(hour, minute)).period, period);
});
check('Daylight slots are exactly 06,08,10,12,14,16 and stable inside each two-hour window', () => {
  for (let slot = 0; slot < 6; slot++) {
    const start = Model.background(date(6 + slot * 2), assets), end = Model.background(date(7 + slot * 2, 59), assets);
    assert.equal(start.slot, slot); assert.equal(start.key, end.key); assert.deepEqual(start.image, end.image);
    if (slot) assert.notEqual(start.image.id, Model.background(date(4 + slot * 2), assets).image.id);
  }
});
check('Daylight changes at the boundary and repeated loads preserve the selection', () => {
  assert.notEqual(Model.background(date(7,59), assets).image.id, Model.background(date(8), assets).image.id);
  assert.deepEqual(Model.background(date(12), assets), Model.background(date(12), assets));
  assert.notEqual(Model.schedule(date(12)).key, Model.schedule(date(12,0,20)).key);
});
check('Every world selects a matching, existing image and a nonempty music playlist', () => {
  for (const hour of [2,12,19,22]) {
    const world = Model.background(date(hour), assets);
    assert(assets.backgrounds[world.period].some(image => image.id === world.image.id));
    assert(assets.playlists[world.period].length >= 3);
  }
  for (const group of Object.values(assets.backgrounds)) for (const image of group) assert(fs.existsSync(path.resolve(__dirname, '../design', image.src)));
  for (const track of Object.values(assets.tracks)) assert(fs.existsSync(path.resolve(__dirname, '../design', track.src)));
});
check('Cave music uses actual deep-dark / dripstone / lush-cave game tracks', () => {
  assert.deepEqual(assets.playlists.cave, ['ancestry','deeper','infinite_amethyst','floating_dream','echo_in_the_wind']);
  assert.equal(assets.effects.cave.length, 23);
});
check('A rare cave cue is scheduled 7–16 minutes apart', () => {
  assert.equal(Model.caveDelay(() => 0), 420000); assert.equal(Model.caveDelay(() => 1), 960000);
});
check('Next-track selection avoids immediate repeats, including both random endpoints', () => {
  assert.equal(Model.chooseTrack(['a','b'], 'a', () => 0), 'b');
  assert.equal(Model.chooseTrack(['a','b'], 'b', () => .999999), 'a');
  assert.equal(Model.chooseTrack(['a'], 'a'), 'a');
});
check('Music and effects default on at gentle, independent volumes', () => {
  assert.deepEqual(Model.preferences(null), Model.defaults);
  assert(Model.defaults.musicVolume < Model.defaults.effectsVolume);
});
check('Audio preferences validate, clamp, and round-trip without touching other storage', () => {
  assert.deepEqual(Model.preferences('{broken'), Model.defaults);
  assert.deepEqual(Model.preferences(JSON.stringify({ effects:false, music:false, news:false, musicVolume:99, effectsVolume:-2 })), { effects:false, music:false, news:false, musicVolume:1, effectsVolume:0 });
  assert.equal(Model.preferences(JSON.stringify({ music:'false' })).music, true);
});
const article = (slug, published, extra = {}) => ({ title: slug, url:'https://www.minecraft.net/en-us/article/' + slug, published, ...extra });
const baseline = Model.ingestNews([article('first',100),article('older',80)],null);
check('Initial news check creates a baseline without calling archived articles new', () => { assert.equal(baseline.fresh.length,0); assert.equal(baseline.state.watermark,100); });
check('New articles alert once; repeated checks and a restart do not repeat them', () => {
  const first = Model.ingestNews([article('new',110),article('first',100)],baseline.state);
  assert.equal(first.fresh[0].id,'/article/new');
  assert.equal(Model.ingestNews([article('new',110)],Model.newsState(JSON.stringify(first.state))).fresh.length,0);
});
check('New articles at the same timestamp are detected and older resurfacing posts are quiet', () => {
  assert.equal(Model.ingestNews([article('same-time',100)],baseline.state).fresh.length,1);
  assert.equal(Model.ingestNews([article('archive',20)],baseline.state).fresh.length,0);
});
check('Disabling alerts silently advances the baseline', () => {
  const muted = Model.ingestNews([article('muted-new',120)],baseline.state,false);
  assert.equal(muted.fresh.length,0); assert.equal(Model.ingestNews([article('muted-new',120)],muted.state,true).fresh.length,0);
});
check('News URLs are restricted to genuine https Minecraft article paths', () => {
  for (const url of ['javascript:alert(1)','https://minecraft.net.evil.example/article/a','https://user:pass@minecraft.net/article/a','http://minecraft.net/article/a','https://minecraft.net/store','https://www.minecraft.net/en-us/article/a/../../store']) assert.equal(Model.safeArticle(article('a',100,{url})),null);
  assert.equal(Model.safeArticle(article('a',100,{url:'https://www.minecraft.net/article/a?tracking=1#hash'})).url,'https://www.minecraft.net/article/a');
});
check('Malformed or empty news cannot erase the baseline or produce an alert', () => {
  assert.equal(Model.ingestNews([{title:'bad',url:'broken'}],baseline.state).state,baseline.state);
  assert.equal(Model.newsState('{broken'),null);
});
check('A news burst queues at most three alerts in chronological order', () => {
  const result=Model.ingestNews([article('five',150),article('four',140),article('three',130),article('two',120)],baseline.state);
  assert.deepEqual(result.fresh.map(item=>item.title),['three','four','five']); assert.equal(result.state.seen.length,6);
});
class Storage {
  constructor() { this.data=new Map(); this.fail=null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key,value) { if(key===this.fail) throw Error('Quota'); this.data.set(key,value); }
}
function oldInventory() {
  const storage = new Storage(), model = new Inventory(catalog,storage);
  model.remove('bookmark-minecraft-news'); delete model.data.newsShortcut;
  model.edit('bookmark-minecart',{title:'LEEPLAY',url:model.entry('bookmark-minecart').url});
  model.move('bookmark-pinterest',{type:'slot',key:35});
  const raw=JSON.stringify(model.data);storage.setItem(Inventory.key,raw);return {storage,raw,data:model.snapshot()};
}
check('News shortcut migration preserves all existing site data and displaces slot nine safely', () => {
  const {storage,raw,data}=oldInventory(), model=new Inventory(catalog,storage);
  assert.equal(storage.getItem(Inventory.newsBackupKey),raw); assert.equal(model.data.slots[35],'bookmark-minecraft-news');
  assert.equal(model.entry('bookmark-minecraft-news').url,'https://www.minecraft.net/en-us/article');
  for(const [id,entry] of Object.entries(data.entries)) assert.deepEqual(model.entry(id),entry);
  assert(model.data.slots.includes('bookmark-pinterest')); assert.equal(model.entry('bookmark-minecart').title,'LEEPLAY');
});
check('A moved or deleted news shortcut is respected after its one-time migration', () => {
  const {storage}=oldInventory(), model=new Inventory(catalog,storage); model.move('bookmark-minecraft-news',{type:'slot',key:20});
  assert.equal(new Inventory(catalog,storage).data.slots[20],'bookmark-minecraft-news');
  model.remove('bookmark-minecraft-news'); assert.equal(new Inventory(catalog,storage).data.entries['bookmark-minecraft-news'],undefined);
});
check('Failed news backup or replacement preserves the exact previous bookmarks', () => {
  for(const key of [Inventory.newsBackupKey,Inventory.key]) {
    const {storage,raw,data}=oldInventory();storage.fail=key;const model=new Inventory(catalog,storage);
    assert.equal(model.readOnly,true);assert.equal(storage.getItem(Inventory.key),raw);assert.deepEqual(model.snapshot(),data);
  }
});
check('An occupied Water Bucket icon defers migration without stealing or losing a site', () => {
  const {storage,data}=oldInventory();data.entries['bookmark-github'].itemId='water_bucket';const raw=JSON.stringify(data);storage.setItem(Inventory.key,raw);
  const model=new Inventory(catalog,storage);assert.equal(model.readOnly,false);assert.equal(storage.getItem(Inventory.key),raw);assert.deepEqual(model.snapshot(),data);assert(model.loadError);
});
const out=path.resolve(__dirname,'../design/evidence/v6');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'ambience-model.json'),JSON.stringify({scope:'Local-clock schedule, verified media, audio preferences, news deduplication and safe bookmark migration; browser playback checked separately',checks},null,2));
console.log(JSON.stringify({passed:checks.length}));
