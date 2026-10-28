/* The CPU riders (Foxy and Froggy, and the title demo's riders), and the autopilot the checks use.
   decide(M, k) runs each time rider k reaches the middle of a cell and returns its next direction. It looks at going
   straight, left and right: never a way into the wall or a trail while another way is open, and among the open ones
   it likes lots of room (a flood fill), a long straight run ahead, and keeping on straight.
   🔥 NORMAL riders also steer clear of the cell another bike is about to ride into.
   🐣 EASY riders look less far ahead and sometimes daydream: they don't look at all and just keep going straight
   (that's how Foxy bumps into the wall now and then, with a silly BOING).
   Every dice roll uses the race's seeded dice (M.rng), so the same race plays out the same way every time. */
(function () {
  'use strict';
  const CAP = 140;
  const PILOT = { look: 12, blunder: 0, wander: 0.02, dodge: true };

  function run(M, x, y, d, max) {
    let n = 0;
    while (n < max && M.free(x, y)) { n++; x += M.DX[d]; y += M.DY[d]; }
    return n;
  }
  // the cells other bikes ride into next
  function nextCells(M, k) {
    const out = [];
    for (const q of M.riders) if (q.k !== k && q.alive) out.push(M.at(q.x + M.DX[q.dir], q.y + M.DY[q.dir]));
    return out;
  }

  function decide(M, k) {
    const r = M.riders[k];
    const C = r.pilot && r.human ? PILOT : M.D.cpu;
    const opts = [r.dir, (r.dir + 3) % 4, (r.dir + 1) % 4];
    const rec = M.log ? { k, x: r.x, y: r.y, from: r.dir, anyFree: false, dir: r.dir, wall: false, diff: M.diff, daydream: false } : null;
    for (const o of opts) if (M.free(r.x + M.DX[o], r.y + M.DY[o])) { if (rec) rec.anyFree = true; break; }
    let best = r.dir;
    if (C.blunder && M.rng() < C.blunder) {
      if (rec) rec.daydream = true; // keeps going straight, whatever is there
    } else {
      const avoid = C.dodge ? nextCells(M, k) : [];
      let bs = -Infinity;
      const wiggle = M.rng() < C.wander;
      for (const o of opts) {
        const nx = r.x + M.DX[o], ny = r.y + M.DY[o];
        const blind = M.sab.cpuBlind && !M.inside(nx, ny);
        if (!blind && !M.free(nx, ny)) continue; // never into the wall or a trail while another way is open
        let s = blind ? CAP : M.room(nx, ny, CAP);
        s += Math.min(blind ? C.look : run(M, nx, ny, o, C.look), C.look) * 2;
        if (o === r.dir) s += 3;
        if (wiggle && o !== r.dir) s += 6;
        if (avoid.includes(M.at(nx, ny)) && M.inside(nx, ny)) s -= 60;
        s += M.rng() * 1.5;
        if (s > bs) { bs = s; best = o; }
      }
    }
    if (rec) {
      rec.dir = best;
      rec.wall = !M.inside(r.x + M.DX[best], r.y + M.DY[best]);
      M.log.push(rec);
    }
    return best;
  }

  TR.Bot = { decide, run };
})();
