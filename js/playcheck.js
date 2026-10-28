/* The play check with real keys: game.playCheck() in the page. Everything here goes in the way a child's hands do:
   keydown / keyup events on window, and pointer events on the touch pad and the BOOST button. Time runs through
   game.step (the same frame code as the real loop); nothing calls the rules to steer anyone (it only sets a bike on
   an empty arena and parks the others while a direction is measured).
     direction  EASY and NORMAL, the wide arena and the tall one (a phone held upright), 1 and 2 players, each
                player's own keys: → turns the bike right on the screen, ← left, ↑ up, ↓ down (measured where the
                bike is drawn, projected through the camera), and the key straight back does nothing
     touch      the round pad turns him the way the finger points, sliding round turns again, BOOST is faster,
                and in 2 players each pad steers its own brother
     stuck      after a bubble bounce, the companion's slow-motion visit, pausing with a key held down, the window
                losing focus and a high five: he keeps riding and answers the next key. Then a "keyboard kid" mashes
                keys through whole cups (EASY and NORMAL, 1 and 2 players): every round he rides, every cup ends
   game.playCheck({ mirror: true }) swaps left and right in the input, and { stuckSlow: true } leaves the companion's
   slow motion on for good: both must fail (game.playCheck.prove() runs them). */
(function () {
  'use strict';
  const NAMES = ['up', 'right', 'down', 'left'];
  const K1 = ['KeyW', 'KeyD', 'KeyS', 'KeyA'], K2 = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
  const kd = (code) => dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
  const ku = (code) => dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true, cancelable: true }));
  const tap = (code) => { kd(code); step(1 / 60); ku(code); };
  const step = (s) => window.game.step(s, { draw: false });
  const OPP = [2, 3, 0, 1];

  function begin(o) {
    const g = window.game;
    g.hold(true);
    g.autoPause(false);
    g.setTouch(!!o.touch);
    g.start(Object.assign({ skipReady: true, seed: 42 }, o));
    const M = g.M;
    if (o.sabotage) Object.assign(M.sab, o.sabotage);
    return M;
  }
  // an empty arena: rider k in the middle (or at x) heading `dir`, everyone else parked in a corner
  function lone(M, k, dir, x) {
    M.grid.fill(0);
    M.trailVer++;
    M.riders.forEach((r, j) => {
      r.q.length = 0; r.u = 0; r.alive = true; r.fadeT = -1;
      if (j === k) { r.x = x != null ? x : Math.floor(M.W / 2); r.y = Math.floor(M.H / 2); r.dir = dir; r.parked = false; }
      else { r.x = j % 2 ? M.W - 1 : 0; r.y = j < 2 ? 0 : M.H - 1; r.parked = true; }
      r.path = [[M.at(r.x, r.y), M.gen[M.at(r.x, r.y)]]];
      M.grid[M.at(r.x, r.y)] = r.k + 1;
    });
    M.state = 'ride';
    M.buddy = null;
    step(1 / 60);
  }
  const scr = (k) => window.game.riderScreen(k);
  const delta = (a, b) => ({ dx: b.x - a.x, dy: b.y - a.y });
  const okFor = (d, m) => {
    const min = 8;
    if (d === 0) return m.dy < -min && Math.abs(m.dx) < Math.abs(m.dy) / 3;
    if (d === 1) return m.dx > min && Math.abs(m.dy) < Math.abs(m.dx) / 3;
    if (d === 2) return m.dy > min && Math.abs(m.dx) < Math.abs(m.dy) / 3;
    return m.dx < -min && Math.abs(m.dy) < Math.abs(m.dx) / 3;
  };
  // which way the bike went on the screen over the next `secs`
  function moved(k, secs = 0.45) {
    const a = scr(k);
    step(secs);
    return delta(a, scr(k));
  }
  const fmt = (m) => `${m.dx.toFixed(0)},${m.dy.toFixed(0)} px`;

  function directions(o) {
    const fails = [];
    let n = 0;
    for (const diff of ['easy', 'normal']) for (const portrait of [false, true]) for (const two of [false, true]) {
      const M = begin({ diff, two, portrait, sabotage: o.sabotage });
      const humans = two ? [0, 1] : [0];
      for (const k of humans) {
        const sets = two ? [k === 0 ? K1 : K2] : [K1, K2];
        for (const keys of sets) for (const d of [1, 3, 0, 2]) {
          const where = `${diff} ${portrait ? 'tall' : 'wide'} ${two ? '2P' : '1P'} rider ${k + 1} ${keys[d]}`;
          // riding across, then the key: he turns that way on the screen
          lone(M, k, (d + 1) % 4);
          tap(keys[d]);
          step(0.35);
          const m = moved(k);
          n++;
          if (!okFor(d, m)) fails.push(`${where}: went ${fmt(m)} for ${NAMES[d]}`);
          // the key straight back does nothing: he keeps going the way he was
          lone(M, k, d);
          tap(keys[OPP[d]]);
          step(0.2);
          const m2 = moved(k);
          if (!M.riders[k].alive) fails.push(`${where}: the key straight back bumped him`);
          else if (!okFor(d, m2)) fails.push(`${where}: after the key straight back he went ${fmt(m2)}, want ${NAMES[d]} still`);
        }
      }
    }
    return { name: 'direction', fails, tried: n };
  }

  // a finger on the pad, the way it points from the middle
  function finger(el, type, d, id = 7) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width * 0.35;
    const x = cx + [0, R, 0, -R][d], y = cy + [-R, 0, R, 0][d];
    el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true }));
  }
  function touch(o) {
    const fails = [];
    let n = 0;
    for (const diff of ['easy', 'normal']) for (const two of [false, true]) {
      const M = begin({ diff, two, touch: true, sabotage: o.sabotage });
      window.game.fit();
      for (const k of two ? [0, 1] : [0]) {
        const pad = document.getElementById('pad' + k);
        if (!pad.getBoundingClientRect().width) { fails.push(`${diff} ${two ? '2P' : '1P'}: pad ${k + 1} is not on the screen`); continue; }
        for (const d of [1, 3, 0, 2]) {
          lone(M, k, (d + 1) % 4);
          finger(pad, 'pointerdown', d);
          step(1 / 60);
          finger(pad, 'pointerup', d);
          step(0.35);
          const m = moved(k);
          n++;
          if (!okFor(d, m)) fails.push(`${diff} ${two ? '2P' : '1P'} pad ${k + 1} tap ${NAMES[d]}: went ${fmt(m)}`);
        }
        // slide: down on the right, round to the top: right, then up
        lone(M, k, 2);
        finger(pad, 'pointerdown', 1);
        step(0.4);
        finger(pad, 'pointermove', 0);
        step(0.4);
        finger(pad, 'pointerup', 0);
        step(0.1);
        const m = moved(k);
        if (!okFor(0, m)) fails.push(`${diff} ${two ? '2P' : '1P'} pad ${k + 1}: sliding round to the top went ${fmt(m)}`);
        // BOOST: faster
        lone(M, k, 1);
        const r = M.riders[k];
        const x0 = r.x + r.u;
        step(0.5);
        const plain = r.x + r.u - x0;
        const btn = document.getElementById('act' + k);
        btn.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true, cancelable: true }));
        btn.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'touch', bubbles: true, cancelable: true }));
        const x1 = r.x + r.u;
        step(0.5);
        const fast = r.x + r.u - x1;
        if (!(fast > plain * 1.4)) fails.push(`${diff} ${two ? '2P' : '1P'} BOOST ${k + 1}: ${fast.toFixed(2)} cells against ${plain.toFixed(2)}`);
      }
    }
    window.game.setTouch(false);
    return { name: 'touch', fails, tried: n };
  }

  // he is riding and the next key turns him
  function answers(M, k, keys, why, fails) {
    const r = M.riders[k];
    if (!r.alive) { fails.push(`${why}: he is out (${r.why})`); return; }
    if (M.state !== 'ride') { fails.push(`${why}: the race is ${M.state}`); return; }
    const a = r.x * 1e3 + r.y, u0 = r.u;
    step(0.3);
    if (r.x * 1e3 + r.y === a && r.u === u0) { fails.push(`${why}: he is not moving`); return; }
    const side = (r.dir + 1) % 4;
    tap(keys[side]);
    step(0.35);
    if (r.dir !== side) fails.push(`${why}: ${keys[side]} did not turn him (heading ${NAMES[r.dir]})`);
  }
  function stuck(o) {
    const fails = [];
    const sab = o.sabotage;
    for (const diff of ['easy', 'normal']) {
      // a bubble bounce (EASY) or a bump (NORMAL) at the wall
      let M = begin({ diff, sabotage: sab });
      lone(M, 0, 1, M.W - 3);
      step(1.2);
      if (diff === 'easy') answers(M, 0, K1, `${diff}: after the bubble bounce`, fails);
      // the companion's visit: slow motion, then back to full speed
      M = begin({ diff, sabotage: sab });
      lone(M, 0, 1, 3);
      tap('KeyT');
      if (!M.buddy) fails.push(`${diff}: T did not call his brother`);
      step(3.4);
      if (M.buddy || M.slowNow()) fails.push(`${diff}: the companion is still there (slow motion ${M.slowNow()}) after 3.4 s`);
      else {
        const r = M.riders[0];
        const c0 = r.cells;
        step(1);
        if (r.cells - c0 < Math.floor(M.D.speed) - 1) fails.push(`${diff}: after the companion he rides ${r.cells - c0} cells a second`);
        answers(M, 0, K1, `${diff}: after the companion`, fails);
      }
      // pause with a key held down, resume, and press it again
      M = begin({ diff, sabotage: sab });
      lone(M, 0, 0);
      kd('KeyA'); // held, never let go
      step(0.4);
      tap('KeyP');
      if (window.game.screen() !== 'pause') fails.push(`${diff}: P did not pause`);
      step(0.5);
      tap('KeyP');
      if (window.game.screen() !== 'play') fails.push(`${diff}: P did not resume`);
      tap('KeyW');
      step(0.4);
      kd('KeyA');
      step(0.4);
      ku('KeyA');
      if (M.riders[0].dir !== 3) fails.push(`${diff}: A held through the pause no longer turns him (heading ${NAMES[M.riders[0].dir]})`);
      answers(M, 0, K2, `${diff}: after the pause`, fails);
      // the window loses focus with a key down
      lone(M, 0, 0);
      kd('ArrowLeft');
      step(0.4);
      dispatchEvent(new Event('blur'));
      tap('ArrowUp');
      step(0.4);
      kd('ArrowLeft');
      step(0.4);
      ku('ArrowLeft');
      if (M.riders[0].dir !== 3) fails.push(`${diff}: after the window lost focus ← no longer turns him`);
      // 2 players: a high five
      M = begin({ diff, two: true, sabotage: sab });
      lone(M, 0, 1);
      M.riders[1].parked = false;
      M.riders[1].x = 2; M.riders[1].y = M.H - 3; M.riders[1].dir = 1;
      tap('KeyT');
      step(0.5);
      answers(M, 0, K1, `${diff} 2P: Teddy after the high five`, fails);
      answers(M, 1, K2, `${diff} 2P: Tommy after the high five`, fails);
    }
    // the keyboard kid: random keys, whole cups
    const keys = [...K1, ...K2, 'Space', 'Enter', 'KeyT'];
    let cups = 0, runs = 0, rounds = 0;
    for (const diff of ['easy', 'normal']) for (const two of [false, true]) {
      runs++;
      const M = begin({ diff, two, seed: 7 + runs, sabotage: sab });
      let seed = 99 + runs;
      const roll = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      let held = null, lastRound = 0, stillT = 0;
      const watch = M.riders.filter((r) => r.human);
      const last = watch.map((r) => [r.x, r.y, r.u]);
      for (let t = 0; t < 900 && window.game.screen() === 'play'; t += 0.1) {
        if (held) { ku(held); held = null; }
        if (roll() < 0.45) {
          let code = keys[Math.floor(roll() * keys.length)];
          if (code === 'KeyT' && roll() < 0.85) code = 'KeyD';
          kd(code);
          held = code;
        }
        step(0.1);
        if (M.round !== lastRound) { lastRound = M.round; rounds++; }
        // a brother who is riding keeps moving
        let moving = true;
        watch.forEach((r, j) => {
          const now = [r.x, r.y, r.u];
          if (r.alive && M.state === 'ride' && now.every((v, q) => v === last[j][q])) moving = false;
          last[j] = now;
        });
        stillT = moving ? 0 : stillT + 0.1;
        if (stillT > 1.0) { fails.push(`keyboard kid ${diff} ${two ? '2P' : '1P'}: a brother stopped moving in round ${M.round}`); break; }
      }
      if (held) ku(held);
      if (window.game.screen() === 'results') cups++;
      else fails.push(`keyboard kid ${diff} ${two ? '2P' : '1P'}: the cup did not end (screen ${window.game.screen()}, round ${M.round}, state ${M.state})`);
    }
    return { name: 'stuck', fails, cups, runs, rounds };
  }

  function playCheck(o = {}) {
    const g = window.game;
    const t0 = performance.now();
    if (o.mirror) TR.Input.mirror = true;
    const sab = {};
    if (o.stuckSlow) sab.stuckSlow = true;
    const oo = { sabotage: sab };
    const out = [];
    try {
      out.push(directions(oo), touch(oo), stuck(oo));
    } finally {
      TR.Input.mirror = false;
      TR.Input.clear();
      g.menu();
      g.hold(false);
      g.autoPause(true);
    }
    const failed = out.filter((r) => r.fails.length).map((r) => r.name);
    return { ok: !failed.length, failed, secs: +((performance.now() - t0) / 1000).toFixed(1), results: out.map((r) => ({ name: r.name, fails: r.fails.slice(0, 6), n: r.fails.length, tried: r.tried, cups: r.cups, runs: r.runs, rounds: r.rounds })) };
  }
  // both broken versions must fail: mirrored arrows, and slow motion that never ends
  playCheck.prove = function () {
    const mirror = playCheck({ mirror: true }), slow = playCheck({ stuckSlow: true });
    return {
      ok: mirror.failed.includes('direction') && mirror.failed.includes('touch') && slow.failed.includes('stuck'),
      mirror: { failed: mirror.failed, first: (mirror.results.find((r) => r.name === 'direction') || {}).fails.slice(0, 2) },
      stuckSlow: { failed: slow.failed, first: (slow.results.find((r) => r.name === 'stuck') || {}).fails.slice(0, 2) },
    };
  };
  if (window.game) window.game.playCheck = playCheck;
  window.addEventListener('load', () => { if (window.game) window.game.playCheck = playCheck; });
})();
