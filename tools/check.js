#!/usr/bin/env node
/* The headless check in node (no browser, no npm):
     node tools/check.js          the rule checks (js/checks.js), then the same checks with one rule broken at a time
                                  (each must be caught)
   Loads the game's rule files into a sandbox with a fake `window`. Exits 1 if anything fails. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/title.js', 'js/config.js', 'js/sim.js', 'js/bot.js', 'js/checks.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const C = ctx.TR.Checks;
const args = process.argv.slice(2);
let bad = 0;

const t0 = Date.now();
const all = C.all();
for (const [k, probs] of Object.entries(all.res)) {
  console.log(`${probs.length ? 'FAIL' : 'pass'}  ${k}`);
  for (const p of probs) console.log('        ' + p);
}
if (!all.ok) bad++;
if (args.includes('-v')) {
  const cw = C.cpuWall({});
  console.log(`\ncpuWall: ${cw.decisions} NORMAL CPU decisions looked at`);
  console.log('\nrounds:\n  ' + C.rounds({}).cups.join('\n  '));
  console.log('\nfps:\n  ' + C.fps({}).rows.join('\n  '));
}

if (!args.includes('--no-prove')) {
  const pr = C.prove();
  console.log(`\nprove: ${pr.rows.filter((r) => r.caught).length} of ${pr.rows.length} broken rules caught`);
  for (const r of pr.rows) console.log(`  ${r.caught ? 'caught' : 'MISSED'}  ${r.flag.padEnd(12)} -> ${r.want}${r.caught ? '  (' + r.why + ')' : ''}`);
  if (!pr.ok) bad++;
}
console.log(`\n${bad ? 'FAILED' : 'ALL PASS'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(bad ? 1 : 0);
