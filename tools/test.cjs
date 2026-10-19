'use strict';
const { spawnSync } = require('node:child_process'), path = require('node:path');
const root = path.resolve(__dirname,'..');
for (const test of ['inventory-model','language-player','ambience','unread','unread-controller','resource-packs','browser','migration']) {
  const result = spawnSync(process.execPath,[path.join(root,'tests',test+'.cjs')],{stdio:'inherit',env:{...process.env,MC_PACK_TEST_MODULES:path.join(root,'node_modules')}});
  if (result.status !== 0) process.exit(result.status || 1);
}
