/* The rules of TT Trail Racer, with no drawing, so the headless check (js/checks.js, node tools/check.js) runs them
   exactly as the page does.

   The arena is a grid of W x H cells. Each rider rides from cell to cell and leaves a glowing trail on every cell it
   has been on. Directions: 0 up (toward the top of the screen), 1 right, 2 down, 3 left.
   - Riding into the wall or any trail (yours too) is a bump: that rider is out for the round (a soft BOING), and its
     trail sparkles away a second later. Two riders reaching the same cell at the same moment both bump.
   - A turn you press is kept until the bike reaches the middle of its next cell, then it turns there. Pressing the
     way you came from does nothing: nobody ever turns straight back into their own trail.
   - 🐣 EASY: each brother has a bubble shield for his first bump of a round. It pops and bounces him left or right,
     whichever way has more room.
   - BOOST: a short burst of speed, then it charges up again.
   - The last rider riding wins the round (+500); the first to win 5 rounds wins the cup. In 1 player a bump costs a
     life, and with no lives left the cup is over.
   - Time moves in fixed ticks (TUNE.HZ a second), whatever the frame rate, and the CPU riders' dice are seeded, so the
     same keys at the same moments give the same race at 30 fps or 240 fps.
   - The companion (1 player): the race goes slow-motion while he pops in, does his signature move and tosses a treat,
     then ZAP: every trail within a few cells of you is gone. Call him as often as you like.
   M.sab holds deliberate breakages, only for the check's "can it fail?" run. */
(function () {
  'use strict';
  const TUNE = TR.TUNE;
  const HZ = TUNE.HZ, TICK = 1 / HZ;
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0], OPP = [2, 3, 0, 1];
  const TRANS = [3, 2, 1, 0]; // a tall arena is the wide one turned on its side: right becomes down, and so on

  // seeded dice (mulberry32)
  function dice(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // where each rider starts, as a share of the arena, and which way it faces: four lanes that cross later on
  const SLOTS = [
    { fx: 0.16, fy: 0.3, dir: 1 },
    { fx: 0.84, fy: 0.7, dir: 3 },
    { fx: 0.7, fy: 0.12, dir: 2 },
    { fx: 0.3, fy: 0.88, dir: 0 },
  ];

  /* create({ diff, two, portrait, riders: [{ id, human, pilot }], seed, sab, log })
     pilot: the autopilot drives this rider (the title demo, and the checks' "keyboard-free" runs). */
  function create(o) {
    const D = TUNE[o.diff === 'normal' ? 'normal' : 'easy'];
    let W = o.W || D.W, H = o.H || D.H;
    if (o.portrait) [W, H] = [H, W];
    const M = {
      W, H, D, diff: o.diff === 'normal' ? 'normal' : 'easy', two: !!o.two, portrait: !!o.portrait,
      grid: new Int16Array(W * H), gen: new Int32Array(W * H), seen: new Int32Array(W * H), stack: new Int32Array(W * H), stamp: 0,
      riders: [], state: 'ready', readyT: 0, endT: 0, round: 1, t: 0, rt: 0, acc: 0, trailVer: 0,
      events: [], rng: dice(o.seed == null ? 1 : o.seed), sab: Object.assign({}, o.sab), log: o.log ? [] : null,
      buddy: null, winner: -1, match: null, lives: null, hasHumans: false,
    };
    M.riders = o.riders.map((q, k) => ({
      k, id: q.id, human: !!q.human, pilot: !!q.pilot, x: 0, y: 0, dir: 1, u: 0, q: [], alive: true, shield: false,
      boostT: 0, coolT: 0, path: [], wins: 0, score: 0, cells: 0, fadeT: -1, why: '', bounces: 0, turns: 0,
    }));
    M.hasHumans = M.riders.some((r) => r.human && !r.pilot);
    M.lives = M.two || !M.hasHumans ? null : D.lives;

    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const at = (x, y) => y * W + x;
    M.inside = inside;
    M.at = at;
    M.free = (x, y) => inside(x, y) && !M.grid[at(x, y)];
    M.DX = DX; M.DY = DY; M.OPP = OPP;

    function lay(r) {
      const i = at(r.x, r.y);
      M.grid[i] = r.k + 1;
      r.path.push([i, M.gen[i]]);
    }
    function clearCell(i) {
      M.grid[i] = 0;
      M.gen[i]++;
    }
    function place() {
      M.grid.fill(0);
      M.gen.fill(0);
      M.trailVer++;
      M.riders.forEach((r, k) => {
        const s = SLOTS[k % 4];
        const fx = M.portrait ? s.fy : s.fx, fy = M.portrait ? s.fx : s.fy;
        r.x = Math.max(1, Math.min(W - 2, Math.round(fx * (W - 1))));
        r.y = Math.max(1, Math.min(H - 2, Math.round(fy * (H - 1))));
        r.dir = M.portrait ? TRANS[s.dir] : s.dir;
        r.u = 0; r.q.length = 0; r.alive = true; r.fadeT = -1; r.why = ''; r.bounces = 0;
        r.shield = M.D.shield && r.human && !M.sab.noShield;
        r.boostT = 0; r.coolT = 0; r.path = [];
        lay(r);
      });
      M.state = 'ready';
      M.readyT = 0;
      M.t = 0;
      M.winner = -1;
      M.events.push({ type: 'ready', round: M.round });
    }
    M.place = place;

    // ---------------------------------------------------------------- what the keys (or a finger) ask for
    M.turn = function (i, d) {
      const r = M.riders[i];
      if (!r || !r.alive || r.pilot || d < 0 || d > 3) return false;
      if (M.state === 'ready') { r.dir = d; r.q.length = 0; return true; } // pick the way you'll set off
      if (M.state !== 'ride') return false;
      const planned = r.q.length ? r.q[r.q.length - 1] : r.dir;
      if (d === planned) return false;
      if (d === OPP[planned] && !M.sab.reverse) return false; // never straight back
      r.q.push(d);
      if (r.q.length > 3) r.q.shift();
      return true;
    };
    M.boost = function (i) {
      const r = M.riders[i];
      if (!r || !r.alive || M.state !== 'ride' || r.boostT > 0 || r.coolT > 0) return false;
      r.boostT = TUNE.boost.time;
      M.events.push({ type: 'boost', k: i });
      return true;
    };
    // the turn waiting for this cell, if it is one a bike can make
    function applyTurn(r) {
      while (r.q.length) {
        const d = r.q.shift();
        if (d === r.dir) continue;
        if (d === OPP[r.dir] && !M.sab.reverse) continue;
        r.dir = d;
        r.turns++;
        return;
      }
    }

    // ---------------------------------------------------------------- the companion
    M.callBuddy = function (i) {
      if (M.two) { M.events.push({ type: 'five' }); return true; }
      const r = M.riders[i];
      if (!r || !r.human) return false;
      if (M.state === 'matchEnd') return false;
      if (!r.alive || M.state === 'roundEnd') { M.events.push({ type: 'cheer', k: i }); return false; }
      const b = M.buddy;
      if (b) {
        if (!b.zapped) b.again = true; // one more ZAP when he's done
        else { zap(b.owner); b.bye = b.t + 1.1; }
        return true;
      }
      M.buddy = { t: 0, owner: i, slow: true, treated: false, zapped: false, again: false, bye: TUNE.buddy.bye };
      M.events.push({ type: 'buddy', k: i });
      return true;
    };
    function zap(i) {
      const r = M.riders[i];
      const R = M.D.radius;
      const heads = new Set(M.riders.map((q) => at(q.x, q.y)));
      let n = 0;
      if (!M.sab.noClear) {
        for (let y = Math.max(0, r.y - R); y <= Math.min(H - 1, r.y + R); y++) {
          for (let x = Math.max(0, r.x - R); x <= Math.min(W - 1, r.x + R); x++) {
            const i2 = at(x, y);
            if (!M.grid[i2] || heads.has(i2)) continue;
            if ((x - r.x) * (x - r.x) + (y - r.y) * (y - r.y) > R * R + 0.5) continue;
            clearCell(i2);
            n++;
          }
        }
      }
      M.trailVer++;
      M.events.push({ type: 'zap', k: i, x: r.x, y: r.y, n, R });
    }
    M.zap = zap;
    function buddyTick() {
      const b = M.buddy, B = TUNE.buddy;
      b.t += TICK;
      if (!b.treated && b.t >= B.treat) { b.treated = true; M.events.push({ type: 'treat', k: b.owner }); }
      if (!b.zapped && b.t >= B.zap) {
        b.zapped = true;
        b.slow = false;
        b.zapAt = b.t;
        zap(b.owner);
      }
      if (b.again && b.zapped && b.t >= b.zapAt + B.again) {
        b.again = false;
        zap(b.owner);
        b.bye = Math.max(b.bye, b.t + 1.1);
      }
      if (M.sab.stuckSlow) b.slow = true;
      if (b.t >= b.bye && !M.sab.stuckSlow) { M.buddy = null; M.events.push({ type: 'buddyBye' }); }
    }

    // ---------------------------------------------------------------- riding
    function room(x, y, cap) {
      // how many free cells you can reach from here (up to cap): a flood fill
      if (!M.free(x, y)) return 0;
      const stamp = ++M.stamp;
      let top = 0, n = 0;
      M.stack[top++] = at(x, y);
      M.seen[at(x, y)] = stamp;
      while (top && n < cap) {
        const i = M.stack[--top];
        n++;
        const cx = i % W, cy = (i / W) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = cx + DX[d], ny = cy + DY[d];
          if (!inside(nx, ny)) continue;
          const j = at(nx, ny);
          if (M.grid[j] || M.seen[j] === stamp) continue;
          M.seen[j] = stamp;
          M.stack[top++] = j;
        }
      }
      return n;
    }
    M.room = room;

    function bump(r, why) {
      r.alive = false;
      r.why = why;
      r.fadeT = TUNE.fadeT;
      r.q.length = 0;
      r.boostT = 0;
      M.events.push({ type: 'bump', k: r.k, why, x: r.x, y: r.y, dir: r.dir });
      if (r.human && !r.pilot && M.lives !== null) {
        M.lives = Math.max(0, M.lives - 1);
        M.events.push({ type: 'life', lives: M.lives });
      }
    }
    function raceTick() {
      M.t += TICK;
      const B = TUNE.boost;
      const movers = [];
      for (const r of M.riders) {
        if (!r.alive) {
          if (r.fadeT > 0) {
            r.fadeT -= TICK;
            if (r.fadeT <= 0) {
              for (let i = 0; i < M.grid.length; i++) if (M.grid[i] === r.k + 1) clearCell(i);
              M.trailVer++;
              M.events.push({ type: 'fade', k: r.k });
            }
          }
          continue;
        }
        if (r.parked) continue; // only the checks park a rider: it sits still as a post
        if (r.boostT > 0) { r.boostT -= TICK; if (r.boostT <= 0) { r.boostT = 0; r.coolT = B.cool; } }
        else if (r.coolT > 0) r.coolT = Math.max(0, r.coolT - TICK);
        r.u += M.D.speed * (r.boostT > 0 ? B.mult : 1) * TICK;
        if (r.u >= 1) movers.push(r);
      }
      if (movers.length) {
        const tx = movers.map((r) => r.x + DX[r.dir]), ty = movers.map((r) => r.y + DY[r.dir]);
        const why = movers.map((r, m) => {
          if (!inside(tx[m], ty[m])) return M.sab.noWall ? '' : 'wall';
          if (M.grid[at(tx[m], ty[m])] && !M.sab.noTrail) return 'trail';
          for (let o = 0; o < movers.length; o++) if (o !== m && tx[o] === tx[m] && ty[o] === ty[m]) return 'head';
          return '';
        });
        const bumped = [];
        movers.forEach((r, m) => {
          if (!why[m]) return;
          if (r.shield) {
            // the bubble pops and bounces him the roomier way, left or right
            let best = -1, bs = 0;
            for (const d of [(r.dir + 3) % 4, (r.dir + 1) % 4]) {
              const nx = r.x + DX[d], ny = r.y + DY[d];
              if (!M.free(nx, ny)) continue;
              if (movers.some((q, o) => o !== m && tx[o] === nx && ty[o] === ny)) continue;
              const s = room(nx, ny, 400);
              if (s > bs) { bs = s; best = d; }
            }
            if (best >= 0) {
              r.shield = false;
              r.dir = best;
              r.u = 0;
              r.q.length = 0;
              r.bounces++;
              M.events.push({ type: 'shield', k: r.k, x: r.x, y: r.y, dir: best, why: why[m] });
              return;
            }
          }
          bumped.push([r, why[m]]);
        });
        for (const [r, w] of bumped) bump(r, w);
        if (bumped.length) {
          for (const q of M.riders) if (q.alive) q.score += TUNE.points.outlast * bumped.length;
        }
        movers.forEach((r, m) => {
          if (!r.alive || why[m] || r.u < 1) return;
          r.u -= 1;
          r.x = tx[m];
          r.y = ty[m];
          lay(r);
          r.cells++;
          r.score += TUNE.points.cell;
          if (r.human && !r.pilot) applyTurn(r);
          else {
            r.q.length = 0;
            r.dir = TR.Bot.decide(M, r.k);
          }
        });
      }
      const alive = M.riders.filter((r) => r.alive);
      if (M.riders.length > 1 && alive.length <= 1) endRound(alive[0] || null);
    }
    function endRound(w) {
      M.state = 'roundEnd';
      M.endT = 0;
      M.winner = w ? w.k : -1;
      if (w) { w.wins++; w.score += TUNE.points.round; }
      M.events.push({ type: 'round', winner: M.winner, round: M.round });
      if (w && w.wins >= TUNE.winRounds) M.match = { kind: w.human && !w.pilot ? 'win' : 'cpu', winner: w.k };
      else if (M.lives !== null && M.lives <= 0) M.match = { kind: 'over', winner: -1 };
      if (M.sab.noRoundEnd) { M.state = 'ride'; M.match = null; }
    }

    function realTick() {
      M.rt++;
      if (M.buddy) buddyTick();
      if (M.state === 'ready') {
        M.readyT += TICK;
        if (M.readyT >= TUNE.readyT) { M.state = 'ride'; M.events.push({ type: 'go', round: M.round }); }
      } else if (M.state === 'ride') {
        let n = 1;
        if (M.buddy && M.buddy.slow) n = M.rt % TUNE.buddy.slow === 0 ? 1 : 0;
        else if (M.hasHumans && !M.riders.some((r) => r.alive && r.human && !r.pilot)) n = TUNE.ffwd;
        for (let k = 0; k < n && M.state === 'ride'; k++) raceTick();
      } else if (M.state === 'roundEnd') {
        M.endT += TICK;
        if (M.endT >= TUNE.roundEndT) {
          if (M.match) { M.state = 'matchEnd'; M.events.push({ type: 'match', kind: M.match.kind, winner: M.match.winner }); }
          else { M.round++; place(); }
        }
      }
    }
    // run the race for dt seconds of real time
    M.step = function (dt) {
      if (M.sab.perFrame) { for (let k = 0; k < HZ / 60; k++) realTick(); return; } // the classic bug: one frame = one 60th
      M.acc += dt * HZ;
      const n = Math.floor(M.acc + 1e-6);
      M.acc = Math.max(0, M.acc - n);
      for (let k = 0; k < n; k++) realTick();
    };
    M.speedOf = (r) => M.D.speed * (r.boostT > 0 ? TUNE.boost.mult : 1);
    M.slowNow = () => !!(M.buddy && M.buddy.slow && M.state === 'ride');
    M.alive = () => M.riders.filter((r) => r.alive).length;
    // a short fingerprint of everything that matters, to compare two runs
    M.hash = function () {
      let h = 2166136261;
      const mix = (v) => { h = Math.imul(h ^ (v | 0), 16777619); };
      for (let i = 0; i < M.grid.length; i++) if (M.grid[i]) { mix(i); mix(M.grid[i]); }
      for (const r of M.riders) { mix(r.x); mix(r.y); mix(r.dir); mix(r.wins); mix(r.score); mix(r.cells); mix(r.alive ? 1 : 0); }
      mix(M.round); mix(M.rt);
      return (h >>> 0).toString(16);
    };
    place();
    return M;
  }

  TR.Sim = { create, DX, DY, OPP, TRANS, SLOTS, dice };
})();
