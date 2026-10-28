/* The headless check: the rules in js/sim.js and js/bot.js, with no drawing and no keys. game.check() in the page and
   node tools/check.js run the same code.
     walls      riding into each of the four walls is a bump, one cell short of the edge, on EASY and NORMAL
     trails     your own trail, someone else's trail, two bikes reaching the same cell (both out, nobody wins),
                and two bikes swapping cells
     reverse    pressing the way you came from never turns you round (every direction), and a quick two-step
                U-turn still works
     cpuWall    🔥 NORMAL: across many seeded all-CPU cups (wide and tall arenas), no CPU rider ever picks a way into
                the wall while another way is open, and none bumps into the wall that way
     rounds     every round ends with one winner or a tie; every cup ends (someone wins 5, or 1 player runs out of
                lives), on EASY and NORMAL, 1 and 2 players
     fps        the same key presses at the same moments give exactly the same race at 30, 48, 60, 90, 120, 144 and
                240 frames a second (and the companion's slow motion with them)
     shield     🐣 EASY: a brother's first bump of the round pops his bubble and bounces him; the second is a bump;
                NORMAL and the CPU riders have no bubble
     boost      faster for a moment, then it has to charge up again
     buddy      the companion: slow motion while he says hello, then every trail near you is gone (and the ones far
                away stay), as often as you call; in 2 players T is a high five
   prove() runs everything again with one rule broken at a time; each broken rule must be caught. */
(function () {
  'use strict';
  const TUNE = TR.TUNE;
  const { DX, DY, OPP } = TR.Sim;
  const NAMES = ['up', 'right', 'down', 'left'];

  function mk(o) {
    return TR.Sim.create(Object.assign({ diff: 'normal', seed: 7 }, o, {
      riders: o.riders || [{ id: 'teddy', human: true }, { id: 'foxy' }],
    }));
  }
  // go straight to riding, with nobody but rider 0 moving
  function ride(M, park = true) {
    M.state = 'ride';
    M.events.length = 0;
    if (park) M.riders.forEach((r, k) => { if (k) r.parked = true; });
    return M;
  }
  function put(M, r, x, y, dir) {
    for (let i = 0; i < M.grid.length; i++) if (M.grid[i] === r.k + 1) M.grid[i] = 0;
    r.path = [];
    r.x = x; r.y = y; r.dir = dir; r.u = 0; r.q.length = 0;
    M.grid[M.at(x, y)] = r.k + 1;
  }
  // step until something happens to rider k (or time runs out)
  function until(M, fn, secs = 30, dt = 1 / 60) {
    for (let t = 0; t < secs; t += dt) {
      M.step(dt);
      if (fn()) return true;
    }
    return false;
  }
  const bumpOf = (M, k) => M.events.find((e) => e.type === 'bump' && e.k === k);

  function walls(sab) {
    const fails = [];
    for (const diff of ['easy', 'normal']) for (const portrait of [false, true]) for (let d = 0; d < 4; d++) {
      const M = ride(mk({ diff, portrait, sab }));
      const r = M.riders[0], cpu = M.riders[1];
      r.shield = false;
      put(M, cpu, 0, 0, 1);
      const cx = Math.floor(M.W / 2), cy = Math.floor(M.H / 2);
      put(M, r, cx, cy, d);
      until(M, () => !r.alive, 30);
      const want = { x: d === 1 ? M.W - 1 : d === 3 ? 0 : cx, y: d === 2 ? M.H - 1 : d === 0 ? 0 : cy };
      const e = bumpOf(M, 0);
      if (!e) fails.push(`${diff}${portrait ? ' tall' : ''}: rode ${NAMES[d]} off the arena (at ${r.x},${r.y}) without a bump`);
      else if (e.why !== 'wall' || r.x !== want.x || r.y !== want.y) fails.push(`${diff} ${NAMES[d]}: bumped at ${r.x},${r.y} (${e.why}), want the wall at ${want.x},${want.y}`);
      if (r.x < 0 || r.y < 0 || r.x >= M.W || r.y >= M.H) fails.push(`${diff} ${NAMES[d]}: outside the arena at ${r.x},${r.y}`);
    }
    return fails;
  }

  function trails(sab) {
    const fails = [];
    for (const diff of ['easy', 'normal']) {
      // a box turn into your own trail: right, up, left, down
      let M = ride(mk({ diff, sab }));
      let r = M.riders[0];
      r.shield = false;
      put(M, M.riders[1], 0, 0, 1);
      put(M, r, 10, 10, 1);
      until(M, () => r.x >= 12, 5);
      M.turn(0, 0);
      until(M, () => r.y <= 8, 5);
      M.turn(0, 3);
      until(M, () => r.x <= 11, 5);
      M.turn(0, 2);
      until(M, () => !r.alive, 5);
      let e = bumpOf(M, 0);
      if (!e || e.why !== 'trail') fails.push(`${diff}: rode into his own trail with ${e ? 'a ' + e.why + ' bump' : 'no bump'} (at ${r.x},${r.y})`);
      else if (M.grid[M.at(r.x + DX[r.dir], r.y + DY[r.dir])] !== 1) fails.push(`${diff}: own-trail bump at ${r.x},${r.y} with no trail of his ahead`);
      // someone else's trail across the way
      M = ride(mk({ diff, sab }));
      r = M.riders[0];
      r.shield = false;
      const cpu = M.riders[1];
      put(M, cpu, 20, 2, 2);
      for (let y = 3; y < M.H - 1; y++) { M.grid[M.at(20, y)] = 2; }
      put(M, r, 5, 12, 1);
      until(M, () => !r.alive, 10);
      e = bumpOf(M, 0);
      if (!e || e.why !== 'trail' || r.x !== 19) fails.push(`${diff}: Foxy's trail at x 20: ${e ? e.why + ' bump at ' + r.x + ',' + r.y : 'rode through it to ' + r.x + ',' + r.y}`);
      // two bikes heading for the same cell: both out, a tie
      M = ride(mk({ diff, sab, riders: [{ id: 'teddy', human: true }, { id: 'tommy', human: true }, { id: 'foxy' }] }));
      M.riders.forEach((q) => (q.shield = false));
      put(M, M.riders[2], 0, 0, 1);
      M.riders[2].parked = true;
      M.riders[1].parked = false;
      put(M, M.riders[0], 6, 8, 1);
      put(M, M.riders[1], 12, 8, 3);
      M.riders[2].alive = false; // only the two of them in this round
      until(M, () => M.state !== 'ride', 5);
      const both = [0, 1].map((k) => bumpOf(M, k));
      if (!both[0] || !both[1]) fails.push(`${diff}: head-on at the same cell: ${both.map((b, k) => (b ? b.why : 'rider ' + k + ' still riding')).join(', ')}`);
      else if (both[0].why !== 'head' || both[1].why !== 'head') fails.push(`${diff}: head-on bumps were ${both[0].why}/${both[1].why}, want head/head`);
      if (M.state !== 'roundEnd' || M.winner !== -1) fails.push(`${diff}: head-on round: state ${M.state}, winner ${M.winner} (want a tie)`);
      // swapping cells: the one that moves first hits the other's trail
      M = ride(mk({ diff, sab, riders: [{ id: 'teddy', human: true }, { id: 'tommy', human: true }, { id: 'foxy' }] }));
      M.riders.forEach((q) => (q.shield = false));
      put(M, M.riders[2], 0, 0, 1);
      M.riders[2].alive = false;
      M.riders[1].parked = false;
      put(M, M.riders[0], 6, 8, 1);
      put(M, M.riders[1], 11, 8, 3);
      until(M, () => M.state !== 'ride', 5);
      if (M.riders[0].alive && M.riders[1].alive) fails.push(`${diff}: two bikes rode through each other`);
      if (M.riders[0].x > M.riders[1].x) fails.push(`${diff}: the bikes passed each other (${M.riders[0].x} > ${M.riders[1].x})`);
    }
    return fails;
  }

  function reverse(sab) {
    const fails = [];
    for (const diff of ['easy', 'normal']) for (let d = 0; d < 4; d++) {
      const M = ride(mk({ diff, sab }));
      const r = M.riders[0];
      r.shield = false;
      put(M, M.riders[1], 0, 0, 1);
      put(M, r, Math.floor(M.W / 2), Math.floor(M.H / 2), d);
      const x0 = r.x, y0 = r.y;
      let took = false;
      for (let k = 0; k < 24; k++) { if (M.turn(0, OPP[d])) took = true; M.step(1 / 60); }
      if (took) fails.push(`${diff} heading ${NAMES[d]}: the ${NAMES[OPP[d]]} key was taken`);
      if (!r.alive) fails.push(`${diff} heading ${NAMES[d]}: pressing ${NAMES[OPP[d]]} bumped him (${(bumpOf(M, 0) || {}).why})`);
      else if (r.dir !== d) fails.push(`${diff} heading ${NAMES[d]}: pressing ${NAMES[OPP[d]]} turned him ${NAMES[r.dir]}`);
      else if ((r.x - x0) * DX[d] + (r.y - y0) * DY[d] < 1) fails.push(`${diff} heading ${NAMES[d]}: stopped at ${r.x},${r.y}`);
      // a quick two-step U-turn: a side, then back the way he came, in the next lane
      const side = (d + 1) % 4;
      M.turn(0, side);
      M.turn(0, OPP[d]);
      until(M, () => r.dir === OPP[d] || !r.alive, 3);
      until(M, () => false, 0.6);
      if (!r.alive) fails.push(`${diff} heading ${NAMES[d]}: the two-step U-turn bumped him`);
      else if (r.dir !== OPP[d]) fails.push(`${diff} heading ${NAMES[d]}: the two-step U-turn left him heading ${NAMES[r.dir]}`);
    }
    return fails;
  }

  const FOUR = [{ id: 'teddy' }, { id: 'tommy' }, { id: 'foxy' }, { id: 'froggy' }];
  function cpuWall(sab, n = 6) {
    const fails = [];
    let decisions = 0, wallBumps = 0, picks = 0;
    for (let s = 0; s < n; s++) for (const portrait of [false, true]) {
      const M = TR.Sim.create({ diff: 'normal', portrait, seed: 100 + s, riders: FOUR, log: true, sab });
      for (let t = 0; t < 400 && M.state !== 'matchEnd'; t += 0.05) M.step(0.05);
      decisions += M.log.length;
      for (const q of M.log) {
        if (q.wall && q.anyFree) {
          picks++;
          if (picks <= 3) fails.push(`seed ${100 + s}${portrait ? ' tall' : ''}: ${M.riders[q.k].id} at ${q.x},${q.y} turned ${NAMES[q.dir]} into the wall with a way open`);
        }
      }
    }
    if (picks > 3) fails.push(`...${picks} wall picks in all`);
    if (decisions < 2000) fails.push(`only ${decisions} CPU decisions were looked at`);
    return { fails, decisions, wallBumps };
  }

  function rounds(sab) {
    const fails = [];
    const cups = [];
    const kinds = [
      ['1P', [{ id: 'teddy', human: true, pilot: true }, { id: 'foxy' }, { id: 'froggy' }]],
      ['2P', [{ id: 'teddy', human: true, pilot: true }, { id: 'tommy', human: true, pilot: true }, { id: 'foxy' }, { id: 'froggy' }]],
      ['CPU', FOUR],
    ];
    for (const diff of ['easy', 'normal']) for (const [name, riders] of kinds) for (const seed of [3, 4]) {
      const M = TR.Sim.create({ diff, seed, riders, two: name === '2P', sab });
      let roundT = 0, longest = 0, rounds = 0, ties = 0;
      for (let t = 0; t < 1500 && M.state !== 'matchEnd'; t += 0.05) {
        const was = M.state;
        M.step(0.05);
        if (M.state === 'ride') { roundT += 0.05; longest = Math.max(longest, roundT); }
        if (was === 'ride' && M.state === 'roundEnd') { rounds++; roundT = 0; if (M.winner < 0) ties++; }
      }
      const top = Math.max(...M.riders.map((r) => r.wins));
      const wins = M.riders.reduce((a, r) => a + r.wins, 0);
      cups.push(`${diff} ${name} seed ${seed}: ${M.state === 'matchEnd' ? M.match.kind + ' ' + M.riders[M.match.winner].id : M.state} after ${rounds} rounds (${M.riders.map((r) => r.wins).join('-')}, ${ties} ties, longest ${longest.toFixed(0)} s)`);
      if (M.state !== 'matchEnd') fails.push(`${diff} ${name} seed ${seed}: no cup winner after 1500 s (${rounds} rounds, state ${M.state})`);
      else if (top !== TUNE.winRounds) fails.push(`${diff} ${name} seed ${seed}: the cup ended with a top score of ${top}`);
      if (wins + ties !== rounds) fails.push(`${diff} ${name} seed ${seed}: ${rounds} rounds but ${wins} wins and ${ties} ties`);
      if (longest > 240) fails.push(`${diff} ${name} seed ${seed}: a round lasted ${longest.toFixed(0)} s`);
    }
    // 1 player, a brother who never steers: every bump costs a life, and the cup ends when they're gone
    for (const diff of ['easy', 'normal']) {
      const M = TR.Sim.create({ diff, seed: 5, riders: [{ id: 'tommy', human: true }, { id: 'foxy' }, { id: 'froggy' }], sab });
      const lives0 = M.lives;
      for (let t = 0; t < 900 && M.state !== 'matchEnd'; t += 0.05) M.step(0.05);
      const lost = M.events.filter((e) => e.type === 'life').length;
      if (M.state !== 'matchEnd' || !M.match) fails.push(`${diff}: a brother who never steers: no end to the cup (${M.state}, lives ${M.lives})`);
      else if (M.match.kind === 'over' && (M.lives !== 0 || lost !== lives0)) fails.push(`${diff}: over with ${M.lives} lives left after ${lost} lost`);
      cups.push(`${diff} 1P, never steers: ${M.match ? M.match.kind : M.state}, lives ${lives0} -> ${M.lives}`);
    }
    return { fails, cups };
  }

  // the same presses at the same moments, at different frame rates
  const FPS = [30, 48, 60, 90, 120, 144, 240];
  function script(seed, two) {
    const roll = TR.Sim.dice(seed);
    const out = [];
    for (let k = 1; k < 6 * 120; k++) {
      // presses land on sixths of a second, which every one of those frame rates has a frame for
      const v = roll();
      if (v < 0.22) out.push({ k, who: two && roll() < 0.5 ? 1 : 0, act: 'turn', d: Math.floor(roll() * 4) });
      else if (v < 0.25) out.push({ k, who: two && roll() < 0.5 ? 1 : 0, act: 'boost' });
      else if (v < 0.257 && !two) out.push({ k, who: 0, act: 'buddy' });
    }
    return out;
  }
  function playScript(o, fps, secs, sab) {
    const M = TR.Sim.create(Object.assign({}, o, { sab }));
    const presses = script(o.seed + 1, o.two);
    let p = 0;
    const marks = [];
    const frames = secs * fps;
    for (let n = 0; n <= frames; n++) {
      // press everything due by this frame: press k is at k/6 s, so it's due when n / fps >= k / 6
      while (p < presses.length && n * 6 >= presses[p].k * fps) {
        const q = presses[p++];
        if (q.act === 'turn') M.turn(q.who, q.d);
        else if (q.act === 'boost') M.boost(q.who);
        else M.callBuddy(q.who);
      }
      if (n % (fps * 10) === 0) marks.push(M.hash());
      if (n < frames) M.step(1 / fps);
    }
    return { marks, hash: M.hash(), round: M.round, wins: M.riders.map((r) => r.wins).join('-'), state: M.state };
  }
  function fps(sab) {
    const fails = [];
    const rows = [];
    const runs = [
      ['1P NORMAL', { diff: 'normal', seed: 11, riders: [{ id: 'teddy', human: true }, { id: 'foxy' }, { id: 'froggy' }] }],
      ['1P EASY', { diff: 'easy', seed: 12, riders: [{ id: 'tommy', human: true }, { id: 'foxy' }, { id: 'froggy' }] }],
      ['2P EASY', { diff: 'easy', two: true, seed: 13, riders: [{ id: 'teddy', human: true }, { id: 'tommy', human: true }, { id: 'foxy' }, { id: 'froggy' }] }],
    ];
    for (const [name, o] of runs) {
      const res = FPS.map((f) => playScript(o, f, 60, sab));
      const base = res[2]; // 60 fps
      rows.push(`${name}: ${res.map((r, i) => FPS[i] + 'fps ' + r.hash).join(' ')} (round ${base.round}, wins ${base.wins})`);
      res.forEach((r, i) => {
        if (r.hash !== base.hash) {
          const at = r.marks.findIndex((m, j) => m !== base.marks[j]);
          fails.push(`${name}: ${FPS[i]} fps gives a different race from 60 fps (first different at ${at * 10} s; round ${r.round} vs ${base.round}, wins ${r.wins} vs ${base.wins})`);
        }
      });
      if (base.round < 2) fails.push(`${name}: the scripted race never got past round 1, so it proves little`);
    }
    return { fails, rows };
  }

  function shield(sab) {
    const fails = [];
    // EASY: bubble, then bump
    let M = ride(mk({ diff: 'easy', sab }));
    let r = M.riders[0];
    put(M, M.riders[1], 0, 0, 1);
    put(M, r, 10, 10, 1);
    if (!r.shield) fails.push('EASY: a brother starts the round without his bubble');
    until(M, () => M.events.some((e) => e.type === 'shield' || e.type === 'bump'), 20);
    if (!M.events.some((e) => e.type === 'shield')) fails.push(`EASY: the first bump was not a bubble bounce (${(bumpOf(M, 0) || {}).why || 'no bump'})`);
    else if (!r.alive) fails.push('EASY: the bubble popped but he is out anyway');
    else if (r.dir === 1 || r.dir === 3) fails.push(`EASY: after the bounce he heads ${NAMES[r.dir]}`);
    until(M, () => !r.alive, 30);
    if (r.alive || !bumpOf(M, 0)) fails.push('EASY: the second bump did not end his round');
    // NORMAL: no bubble
    M = ride(mk({ diff: 'normal', sab }));
    r = M.riders[0];
    if (r.shield) fails.push('NORMAL: a brother has a bubble');
    // EASY CPU: no bubble
    M = mk({ diff: 'easy', sab });
    if (M.riders[1].shield) fails.push('EASY: Foxy has a bubble');
    // the bubble comes back next round
    M = ride(mk({ diff: 'easy', sab, riders: [{ id: 'teddy', human: true }, { id: 'foxy' }, { id: 'froggy' }] }));
    M.riders[0].shield = false;
    M.riders[1].alive = false;
    M.riders[2].alive = false;
    until(M, () => M.state === 'ready', 10);
    if (!M.riders[0].shield && !sab.noShield) fails.push('EASY: the bubble did not come back for the next round');
    return fails;
  }

  function boost(sab) {
    const fails = [];
    const M = ride(mk({ diff: 'normal', sab }));
    const r = M.riders[0];
    put(M, M.riders[1], 0, 0, 1);
    put(M, r, 2, 12, 1);
    until(M, () => false, 0.5);
    const x0 = r.x;
    if (!M.boost(0)) fails.push('BOOST did not start');
    until(M, () => false, 1.0);
    const fast = r.x - x0;
    const x1 = r.x;
    until(M, () => false, 0.2);
    if (M.boost(0)) fails.push('BOOST started again while charging');
    until(M, () => false, 1.0);
    const slow = r.x - x1;
    if (!(fast > TUNE.normal.speed * 1.4)) fails.push(`BOOST rode ${fast} cells in a second (normal is ${TUNE.normal.speed})`);
    if (!(slow < fast)) fails.push(`after BOOST he still rides ${slow} cells a second`);
    put(M, r, 2, 5, 1); // back to the left, out of the wall's way
    until(M, () => false, TUNE.boost.cool - 1.0);
    if (!r.alive) fails.push(`he bumped while BOOST charged (${(bumpOf(M, 0) || {}).why})`);
    else if (!M.boost(0)) fails.push('BOOST never charged up again');
    return fails;
  }

  function buddy(sab) {
    const fails = [];
    for (const diff of ['easy', 'normal']) {
      const M = ride(mk({ diff, sab }));
      const r = M.riders[0];
      put(M, M.riders[1], 0, 0, 1);
      put(M, r, 8, 12, 1);
      // a big tangle of Foxy's trail all round, near and far
      for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
        if ((x + y) % 3 === 0 && !(y === 12 && x >= 8)) M.grid[M.at(x, y)] = 2;
      }
      M.callBuddy(0);
      const cells0 = r.cells;
      until(M, () => false, TUNE.buddy.zap - 0.1);
      const slowCells = r.cells - cells0;
      if (!(slowCells <= Math.ceil(M.D.speed * TUNE.buddy.zap / TUNE.buddy.slow) + 1)) fails.push(`${diff}: during hello he rode ${slowCells} cells (no slow motion)`);
      until(M, () => M.events.some((e) => e.type === 'zap'), 1);
      const z = M.events.find((e) => e.type === 'zap');
      if (!z) { fails.push(`${diff}: no ZAP`); continue; }
      let near = 0, far = 0;
      const R = M.D.radius;
      for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
        const dd = (x - z.x) * (x - z.x) + (y - z.y) * (y - z.y);
        const has = M.grid[M.at(x, y)] === 2;
        if (dd <= R * R && has) near++;
        if (dd > (R + 1.5) * (R + 1.5) && (x + y) % 3 === 0 && !(y === 12 && x >= 8) && !has) far++;
      }
      if (near) fails.push(`${diff}: ${near} trail cells left within ${R} of him after the ZAP`);
      if (far) fails.push(`${diff}: ${far} far-away trail cells went too`);
      if (!z.n) fails.push(`${diff}: the ZAP cleared nothing`);
      until(M, () => !M.buddy, 3);
      if (M.buddy) fails.push(`${diff}: he never went home (slow motion stays on: ${M.slowNow()})`);
      // again, and again: unlimited
      let zaps = 0;
      for (let k = 0; k < 3; k++) {
        put(M, r, 4, 12, 1);
        for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) if (y !== 12 && (x + y) % 3 === 0) M.grid[M.at(x, y)] = 2;
        const before = M.events.filter((e) => e.type === 'zap' && e.n > 0).length;
        if (!M.callBuddy(0)) fails.push(`${diff}: call ${k + 2} was refused`);
        until(M, () => !M.buddy, 6);
        zaps += M.events.filter((e) => e.type === 'zap' && e.n > 0).length - before;
      }
      if (!r.alive) fails.push(`${diff}: he bumped during the calls (${(bumpOf(M, 0) || {}).why})`);
      if (zaps !== 3) fails.push(`${diff}: 3 more calls gave ${zaps} ZAPs that cleared trails`);
    }
    // 2 players: T is a high five
    const M2 = ride(mk({ two: true, sab, riders: [{ id: 'teddy', human: true }, { id: 'tommy', human: true }] }), false);
    M2.callBuddy(0);
    if (!M2.events.some((e) => e.type === 'five') || M2.buddy) fails.push('2P: T was not a high five');
    return fails;
  }

  const LIST = { walls, trails, reverse, cpuWall: (s) => cpuWall(s).fails, rounds: (s) => rounds(s).fails, fps: (s) => fps(s).fails, shield, boost, buddy };

  function all(sab = {}) {
    const res = {};
    for (const [k, fn] of Object.entries(LIST)) {
      try { res[k] = fn(sab); } catch (e) { res[k] = ['threw ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)]; }
    }
    const failed = Object.keys(res).filter((k) => res[k].length);
    return { ok: !failed.length, failed, res };
  }
  // each broken rule must make its check fail
  const BREAKS = [
    ['noWall', 'walls'], ['noTrail', 'trails'], ['reverse', 'reverse'], ['cpuBlind', 'cpuWall'], ['noRoundEnd', 'rounds'],
    ['perFrame', 'fps'], ['noShield', 'shield'], ['noClear', 'buddy'], ['stuckSlow', 'buddy'],
  ];
  function prove() {
    const rows = BREAKS.map(([flag, want]) => {
      const fn = LIST[want];
      let probs;
      try { probs = fn({ [flag]: true }); } catch (e) { probs = ['threw ' + e]; }
      return { flag, want, caught: probs.length > 0, why: probs[0] || '', failed: probs.length ? [want] : [] };
    });
    return { ok: rows.every((r) => r.caught), rows };
  }

  TR.Checks = { all, prove, LIST, cpuWall, rounds, fps, playScript };
})();
