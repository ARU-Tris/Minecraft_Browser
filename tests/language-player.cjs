const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I18n = require('../design/i18n.js');
const Pose = require('../design/player-pose.js');
const checks = [];
const check = (name, action) => { action(); checks.push({ name, passed: true }); };
class Storage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.fail = false; this.writes = []; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { if (this.fail) throw Error('Quota exceeded'); this.values.set(key, value); this.writes.push(key); }
}
check('A fresh profile defaults to English without writing any preferences', () => {
  const storage = new Storage(), ui = I18n.create(storage); assert.equal(ui.language, 'en'); assert.equal(ui.t('설정'), 'Settings'); assert.deepEqual(storage.writes, []);
});
check('Unknown or unreadable preferences fall back to English', () => {
  assert.equal(I18n.create(new Storage({ [I18n.key]: 'fr' })).language, 'en');
  assert.equal(I18n.create({ getItem() { throw Error('Denied'); } }).language, 'en');
  assert.equal(I18n.create(null).language, 'en');
});
check('Language changes persist immediately and notify only when the language changes', () => {
  const storage = new Storage(), ui = I18n.create(storage), changes = []; ui.subscribe(value => changes.push(value));
  ui.setLanguage('ko'); ui.setLanguage('ko'); assert.equal(ui.t('Settings'), '설정'); assert.equal(storage.getItem(I18n.key), 'ko'); assert.deepEqual(changes, ['ko']);
});
check('English and Korean preferences survive controller reloads in both directions', () => {
  const storage = new Storage(), ui = I18n.create(storage); ui.setLanguage('ko');
  const next = I18n.create(storage); assert.equal(next.language, 'ko'); next.setLanguage('en'); assert.equal(I18n.create(storage).language, 'en');
});
check('Language changes leave inventory and skin data byte-for-byte unchanged', () => {
  const inventory = '{"title":"나의 사이트","slots":[1,2,3]}', skin = '{"label":"내 스킨.png","data":"png"}';
  const storage = new Storage({ 'craftside:inventory:v1': inventory, 'craftside:player:v2': skin }), ui = I18n.create(storage);
  ui.setLanguage('ko'); ui.setLanguage('en'); assert.equal(storage.getItem('craftside:inventory:v1'), inventory); assert.equal(storage.getItem('craftside:player:v2'), skin); assert(storage.writes.every(key => key === I18n.key));
});
check('Failed language storage rolls back without notifying listeners', () => {
  const storage = new Storage(), ui = I18n.create(storage); let notifications = 0; ui.subscribe(() => notifications++); storage.fail = true;
  assert.throws(() => ui.setLanguage('ko'), /Could not save/); assert.equal(ui.language, 'en'); assert.equal(notifications, 0); assert.equal(storage.getItem(I18n.key), null);
});
check('Only English and Korean can be selected', () => {
  const storage = new Storage(), ui = I18n.create(storage); assert.throws(() => ui.setLanguage('invalid')); assert.equal(ui.language, 'en'); assert.deepEqual(storage.writes, []);
});
check('Template placeholders preserve user titles and use each language’s word order', () => {
  const ui = I18n.create(new Storage()), title = '나의 <사이트> & work';
  assert.equal(ui.t('Edit {title}', { title }), 'Edit ' + title); ui.setLanguage('ko'); assert.equal(ui.t('Edit {title}', { title }), title + ' 편집');
});
check('Detached English and Korean template text resolves correctly after repeated switches', () => {
  const ui = I18n.create(new Storage());
  for (let i = 0; i < 4; i++) { ui.setLanguage('ko'); assert.equal(ui.t('  Crafting  '), '  제작  '); ui.setLanguage('en'); assert.equal(ui.t('  제작  '), '  Crafting  '); }
});
check('Item names follow the selected language with an English fallback', () => {
  const ui = I18n.create(new Storage()), item = { name: 'Diamond Pickaxe', nameKo: '다이아몬드 곡괭이' };
  assert.equal(ui.itemName(item), item.name); ui.setLanguage('ko'); assert.equal(ui.itemName(item), item.nameKo); assert.equal(ui.itemName({ name: 'Custom Item' }), 'Custom Item');
});
check('Unknown content and URLs are preserved', () => {
  const ui = I18n.create(new Storage()); ui.setLanguage('ko');
  for (const value of ['Custom bookmark', '내가 쓴 제목', 'https://login.skku.edu/?retUrl=kc213u9an72n4n33c5l9']) assert.equal(ui.t(value), value);
});
check('Another window can apply a language change without another storage write', () => {
  const storage = new Storage(), ui = I18n.create(storage); ui.setLanguage('ko', false); assert.equal(ui.language, 'ko'); assert.deepEqual(storage.writes, []);
});
const bounds = { left: 100, top: 200, width: 160, height: 210 };
const center = [bounds.left + bounds.width / 2, bounds.top + bounds.height * .23];
check('A pointer aligned with the player’s eyes produces a neutral pose', () => assert.deepEqual(Pose.target(...center, bounds), Pose.neutral()));
check('Body and head turn in the pointer direction while the body turns less and stays bounded', () => {
  for (const sign of [-1, 1]) {
    const pose = Pose.target(center[0] + sign * 10000, center[1], bounds);
    assert.equal(Math.sign(pose.bodyYaw), sign); assert.equal(Math.sign(pose.headYaw), sign);
    assert(Math.abs(pose.bodyYaw) <= .16); assert(Math.abs(pose.headYaw) > Math.abs(pose.bodyYaw)); assert(Math.abs(pose.bodyYaw + pose.headYaw) <= .62);
  }
});
check('Vertical tracking tilts the head without tilting or turning the body', () => {
  const pose = Pose.target(center[0], center[1] + 10000, bounds); assert.equal(pose.bodyYaw, 0); assert.equal(pose.headYaw, 0); assert.equal(pose.headPitch, .24);
});
check('Tracking remains consistent when the player preview is resized', () => {
  const a = Pose.target(center[0] + 80, center[1] + 50, bounds), scaled = { left: 0, top: 0, width: 320, height: 420 };
  const b = Pose.target(160 + 160, 420 * .23 + 100, scaled);
  for (const part of Object.keys(a)) assert(Math.abs(a[part] - b[part]) < 1e-12);
});
check('The head responds faster than the body and neither motion overshoots', () => {
  const desired = Pose.target(center[0] + 300, center[1], bounds), next = Pose.advance(Pose.neutral(), desired, 1 / 60);
  assert(next.headYaw / desired.headYaw > next.bodyYaw / desired.bodyYaw);
  for (const part of ['bodyYaw', 'headYaw']) assert(next[part] > 0 && next[part] < desired[part]);
});
check('Animation smoothing is consistent across frame intervals', () => {
  const target = Pose.target(center[0] + 300, center[1] + 90, bounds), start = Pose.neutral();
  const a = Pose.advance(Pose.advance(start, target, .016), target, .032), b = Pose.advance(start, target, .048);
  for (const part of Object.keys(a)) assert(Math.abs(a[part] - b[part]) < 1e-12);
});
check('Leaving the preview returns smoothly to neutral and eventually stops drawing', () => {
  let pose = Pose.target(center[0] + 1000, center[1] + 1000, bounds);
  for (let i = 0; i < 180; i++) pose = Pose.advance(pose, Pose.neutral(), 1 / 60);
  assert.deepEqual(pose, Pose.neutral()); assert.equal(Pose.settled(pose, Pose.neutral()), true);
});
check('Hidden or invalid preview bounds cannot create NaN rotations', () => {
  assert.deepEqual(Pose.target(0, 0, { left: 0, top: 0, width: 0, height: 0 }), Pose.neutral());
  assert.deepEqual(Pose.target(NaN, 0, bounds), Pose.neutral()); assert.deepEqual(Pose.advance(Pose.neutral(), Pose.neutral(), NaN), Pose.neutral());
});
const output = path.resolve(__dirname, '../design/evidence/v5'); fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'language-player-model.json'), JSON.stringify({ recordedOn: '2026-10-19', scope: 'Language defaults, persistence, failure and data preservation; bounded and frame-consistent head/body tracking. Browser appearance is checked separately.', checks }, null, 2));
console.log(JSON.stringify({ passed: checks.length }));
