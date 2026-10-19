'use strict';
// Deliberately simple diagnostic pixels, not a shipped theme or replacement art.
const fs = require('node:fs'), path = require('node:path'), { zip, png } = require('../tests/pack-fixtures.cjs');
const root = path.resolve(__dirname, '..'), prefix = 'assets/minecraft/';
const rows = [
  ['pack.mcmeta', { pack: { min_format: 84, max_format: 97, description: 'Diagnostic fixture: animation, HD items, models, legacy buttons, armor and sound. Not a default theme.' } }],
  ['pack.png', png(32, 32, [110, 65, 190, 255])],
  [prefix + 'textures/item/emerald.png', png(32, 64, (x, y) => x < 4 || x > 27 ? [0, 0, 0, 0] : y < 32 ? [70, 235, 180, 255] : [175, 85, 240, 255])],
  [prefix + 'textures/item/emerald.png.mcmeta', { animation: { frametime: 5 } }],
  [prefix + 'items/redstone.json', { model: { type: 'minecraft:range_dispatch', property: 'minecraft:damage', entries: [{ threshold: 0, model: { type: 'minecraft:model', model: 'pack_lab:item/redstone' } }] } }],
  ['assets/pack_lab/models/item/redstone.json', { parent: 'minecraft:item/generated', textures: { layer0: 'pack_lab:item/power' } }],
  ['assets/pack_lab/textures/item/power.png', png(128, 128, (x, y) => Math.abs(x - 64) + Math.abs(y - 64) < 55 ? [235, 90, 145, 255] : [0, 0, 0, 0])],
  [prefix + 'textures/block/crafting_table_top.png', png(32, 32, [160, 90, 230, 255])],
  [prefix + 'textures/block/crafting_table_front.png', png(32, 32, [60, 210, 185, 255])],
  [prefix + 'textures/block/crafting_table_side.png', png(32, 32, [70, 140, 225, 255])],
  [prefix + 'textures/gui/widgets.png', png(256, 256, (x, y) => y >= 46 && y < 66 ? [70, 70, 90, 255] : y >= 66 && y < 86 ? [85, 45, 135, 255] : y >= 86 && y < 106 ? [120, 70, 190, 255] : [0, 0, 0, 0])],
  [prefix + 'textures/models/armor/diamond_layer_1.png', png(128, 64, [170, 70, 220, 255])],
  [prefix + 'sounds/random/click_stereo.ogg', fs.readFileSync(path.join(root, 'assets/ambience/sounds/click.ogg'))]
];
const destination = path.join(root, 'design/evidence/v9/fixtures/Pack Lab.zip'); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, zip(rows));
fs.writeFileSync(path.join(root, 'design/evidence/v9/fixtures/Invalid Pack.zip'), Buffer.from('This deliberately is not a ZIP.'));
console.log(JSON.stringify({ fixture: destination, resources: rows.length, scope: 'Synthetic diagnostic archive only' }));
