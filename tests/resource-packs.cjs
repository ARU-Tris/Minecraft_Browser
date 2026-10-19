'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const M = require('../design/resource-pack-model.js'), DB = require('../design/resource-pack-db.js');
const { zip, png, meta, file } = require('./pack-fixtures.cjs');
const { IDBFactory } = require(require.resolve('fake-indexeddb', { paths: [process.env.MC_PACK_TEST_MODULES || path.join(require('node:os').tmpdir(), 'minecraft-browser-pack-tests', 'node_modules')] }));
const checks = [], check = async (name, run) => { await run(); checks.push({ name, passed: true }); };
const item = 'assets/minecraft/textures/item/emerald.png', bytes = png(), pack = extra => file([['pack.mcmeta', meta], [item, bytes], ...extra]);
const read = file => M.importPack(file);
(async () => {
  await check('ZIP CRC matches the standard published test vector', () => assert.equal(M.crc32(Buffer.from('123456789')), 0xcbf43926));
  await check('Stored and deflated Java packs preserve exact PNG bytes and read format metadata', async () => {
    for (const compression of [0, 8]) { const result = await read(file([['pack.mcmeta', meta], [item, bytes]], compression)); assert.deepEqual(Buffer.from(await result.files[0].blob.arrayBuffer()), bytes); assert.equal(result.compatible, true); }
  });
  await check('Same ZIP has a stable identity independent of its local filename', async () => {
    const data = zip([['pack.mcmeta', meta], [item, bytes]]); assert.equal((await read(new File([data], 'a.zip'))).id, (await read(new File([data], 'b.zip'))).id);
  });
  await check('A Unicode wrapper folder is discovered without requiring manual ZIP repacking', async () => {
    const result = await read(file([['나의 팩/pack.mcmeta', meta], ['나의 팩/' + item, bytes]])); assert.equal(result.count, 1); assert.equal(result.files[0].path, item);
  });
  await check('Old pack_format, supported_formats, and modern major/minor ranges are read', () => {
    for (const data of [{ pack_format: 88 }, { pack_format: 15, supported_formats: [15, 97] }, { formats: { min_inclusive: 80, max_inclusive: 97 } }, { min_format: [88, 0], max_format: [88, 3] }]) assert.equal(M.within([88, 0], M.range(data)), true);
    assert.equal(M.within([88, 4], M.range({ min_format: [88, 0], max_format: [88, 3] })), false); assert.equal(M.range({ min_format: 99, max_format: 80 }), null);
  });
  await check('Matching overlays replace root resources in declaration order; incompatible overlays stay out', async () => {
    const metadata = { ...meta, overlays: { entries: [{ directory: 'first', min_format: 84, max_format: 90 }, { directory: 'second', formats: [88, 89] }, { directory: 'future', min_format: 97, max_format: 99 }] } };
    const first = png(16, 16, [1, 2, 3, 255]), second = png(16, 16, [4, 5, 6, 255]);
    const result = await read(file([['pack.mcmeta', metadata], [item, bytes], ['first/' + item, first], ['second/' + item, second], ['future/' + item, bytes]]));
    assert.equal(result.overlays, 2); assert.deepEqual(Buffer.from(await result.files[0].blob.arrayBuffer()), second);
  });
  await check('Different game format remains usable with a compatibility note', async () => {
    const result = await read(file([['pack.mcmeta', { pack: { pack_format: 15, description: 'Old' } }], [item, bytes]])); assert.equal(result.compatible, false); assert.equal(result.count, 1);
  });
  await check('Metadata text is flattened as text and legacy formatting codes are removed', async () => {
    const result = await read(file([['pack.mcmeta', { pack: { pack_format: 88, description: [{ text: '§aHello ', extra: [{ text: '<script>no execution</script>' }] }] } }], [item, bytes]])); assert.equal(result.description, 'Hello <script>no execution</script>');
  });
  await check('Shader, font and mod assets are reported and never imported as executable content', async () => {
    const result = await read(pack([['assets/minecraft/shaders/core/test.vsh', 'void main(){}'], ['assets/minecraft/optifine/cit/test.properties', 'x'], ['assets/minecraft/font/default.json', '{}'], ['assets/minecraft/code.js', 'throw Error()']]));
    assert.deepEqual(result.warnings, { shaders: true, extensions: true, fonts: true }); assert.equal(result.count, 1);
  });
  await check('Bedrock packs and ZIPs without pack.mcmeta give actionable errors', async () => {
    await assert.rejects(read(file([['manifest.json', '{}']])), /Bedrock/); await assert.rejects(read(file([[item, bytes]])), /pack.mcmeta/);
  });
  await check('Bad ZIP, invalid JSON, missing formats and ambiguous pack roots are rejected', async () => {
    await assert.rejects(read(new File(['not zip'], 'bad.zip')), /valid/);
    await assert.rejects(read(file([['pack.mcmeta', '{broken'], [item, bytes]])), /JSON/);
    await assert.rejects(read(file([['pack.mcmeta', { pack: {} }], [item, bytes]])), /format range/);
    await assert.rejects(read(file([['a/pack.mcmeta', meta], ['b/pack.mcmeta', meta], ['a/' + item, bytes]])), /more than one/);
  });
  await check('Traversal, absolute paths, drive paths and duplicate ZIP entries are rejected', async () => {
    for (const name of ['../outside.png', '/absolute.png', 'C:/outside.png', 'assets/../../outside.png', 'assets\\minecraft\\x.png']) await assert.rejects(read(pack([[name, bytes]])), /unsafe/);
    await assert.rejects(read(pack([[item, bytes]])), /duplicate/);
  });
  await check('Central and local file names must agree and CRC failures reject damaged content', async () => {
    const archive = zip([['pack.mcmeta', meta], [item, bytes]], 0), altered = Buffer.from(archive); altered[30] ^= 1; assert.throws(() => M.directory(altered), /damaged/);
    const damaged = Buffer.from(archive), parsed = M.directory(damaged), entry = parsed.entries.find(e => e.name === item); damaged[entry.data + 40] ^= 1; await assert.rejects(read(new File([damaged], 'bad.zip')), /integrity/);
  });
  await check('Inflation is bounded by declared output size as well as the import limit', async () => {
    const archive = M.directory(zip([['test', Buffer.alloc(40000, 1)]])), entry = { ...archive.entries[0], expanded: 1 };
    await assert.rejects(M.extract(archive, entry), /limit/); await assert.rejects(M.extract(archive, { ...entry, expanded: M.limits.file + 1 }), /limit/);
  });
  await check('Texture dimension limits and audio headers are validated before saving a pack', async () => {
    const huge = Buffer.from(bytes); huge.writeUInt32BE(9000, 16); await assert.rejects(read(file([['pack.mcmeta', meta], [item, huge]])), /image size/);
    await assert.rejects(read(pack([['assets/minecraft/sounds/test.ogg', 'not ogg']])), /OGG/);
  });
  await check('Higher selected packs win and missing files fall through to lower packs', async () => {
    const a = await read(pack([])), other = 'assets/minecraft/textures/item/book.png';
    const b = await read(file([['pack.mcmeta', meta], [item, png(32, 32)], [other, bytes]]));
    const stack = M.stack([a, b], [a.id, b.id]); assert.equal(stack.get(item), a.files[0].blob); assert(stack.has(other)); assert.equal(M.stack([a, b], []).size, 0);
  });
  await check('Unknown or repeated selected packs cannot overwrite an existing library', () => {
    assert.throws(() => M.stack([], ['missing']), /damaged/); assert.throws(() => M.stack([], ['same', 'same']), /damaged/);
  });
  await check('Texture animations respect frame dimensions, frame order and tick durations', () => {
    const result = M.animation({ animation: { frametime: 3, frames: [1, { index: 0, time: 5 }] } }, 32, 64);
    assert.equal(result.width, 32); assert.deepEqual(result.frames, [{ index: 1, time: 150 }, { index: 0, time: 250 }]); assert.equal(result.animated, true);
    assert.throws(() => M.animation({ animation: { frames: [10] } }, 16, 32), /invalid frame/); assert.throws(() => M.animation({ animation: { width: 7 } }, 16, 32), /dimensions/);
  });
  await check('Idle item selection uses undamaged/default branches and the GUI display context', () => {
    const good = { type: 'minecraft:model', model: 'minecraft:item/stone_axe' }, damaged = { type: 'minecraft:model', model: 'minecraft:item/damaged' };
    assert.equal(M.neutralModel({ type: 'minecraft:condition', on_false: { type: 'minecraft:range_dispatch', entries: [{ threshold: .5, model: damaged }, { threshold: 0, model: good }] } }), good);
    assert.equal(M.neutralModel({ type: 'minecraft:select', property: 'minecraft:display_context', cases: [{ when: ['gui'], model: good }], fallback: damaged }), good);
    assert.equal(M.neutralModel({ type: 'minecraft:special' }), null);
  });
  await check('Resource references cannot introduce remote URLs or filesystem traversal', () => {
    assert.equal(M.resource('other:item/foo', 'textures'), 'assets/other/textures/item/foo.png');
    for (const name of ['https://evil.test/image', '../../outside', 'file:C:/x', '#unresolved', null]) assert.equal(M.resource(name, 'textures'), null);
  });
  await check('IndexedDB stores blobs and active order atomically and restores them for another client', async () => {
    const factory = new IDBFactory(), a = DB.create(factory), b = DB.create(factory), pack = await read(file([['pack.mcmeta', meta], [item, bytes]]));
    assert.deepEqual(await a.read(), DB.empty()); const saved = await a.write({ schema: 1, packs: [pack], active: [pack.id] }, 0); assert.equal(saved.revision, 1);
    const restored = await b.read(); assert.equal(restored.active[0], pack.id); assert.deepEqual(Buffer.from(await restored.packs[0].files[0].blob.arrayBuffer()), bytes);
  });
  await check('Stale-window writes fail without losing the newer pack order', async () => {
    const factory = new IDBFactory(), a = DB.create(factory), b = DB.create(factory); await a.read(); await b.read();
    await a.write({ packs: [], active: [], marker: 'newest' }, 0); await assert.rejects(b.write({ packs: [], active: [], marker: 'stale' }, 0), /another window/); assert.equal((await a.read()).marker, 'newest');
  });
  await check('An aborted storage write preserves the exact prior library', async () => {
    const db = DB.create(new IDBFactory()); await db.write({ packs: [], active: [], marker: 'keep' }, 0);
    await assert.rejects(db.write({ packs: [], active: [], invalid: () => {} }, 1), /Could not save/); assert.equal((await db.read()).marker, 'keep'); assert.equal((await db.read()).revision, 1);
  });
  await check('Unavailable and corrupt storage reports errors without fabricating default saves', async () => {
    await assert.rejects(DB.create(null).read(), /unavailable/);
    const factory = new IDBFactory(), db = DB.create(factory); await db.write({ packs: 'broken', active: [] }, 0); await assert.rejects(db.read(), /damaged/);
  });
  await check('The actual supplied Vanilla Tweaks ZIP imports matching overlays intact', async () => {
    const input = new File([fs.readFileSync(path.resolve(__dirname, '../assets/default-packs/VanillaTweaks_r106307_MC26.3.x.zip'))], 'VanillaTweaks.zip'), pack = await read(input);
    assert.equal(pack.compatible, true); assert.equal(pack.overlays, 7); assert(pack.files.some(file => file.path === 'assets/minecraft/textures/gui/container/inventory.png')); assert.equal(pack.count, 479);
  });
  const out = path.resolve(__dirname, '../design/evidence/v9'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'resource-pack-tests.json'), JSON.stringify({ scope: 'Real ZIP decoding, format overlays, integrity and limits, static item choices, pack stack and atomic storage with fake-indexeddb 6.2.6. Native UI rendering tested separately.', checks }, null, 2));
  console.log(JSON.stringify({ passed: checks.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
