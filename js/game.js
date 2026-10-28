/* TT Trail Racer: the 3D arena, the riders and their glowing trails, the HUD and menus, keys and touch, the companion,
   the main loop and the window.game test hooks. The rules live in js/sim.js; this file reads its state and turns its
   events into pictures, words and sounds. */
(function () {
  'use strict';
  const T = THREE;
  const gfx = Kit.gfx;
  const People = Kit.people;
  const A = TR.Art;
  const TUNE = TR.TUNE;
  const I = TR.Input;
  const SFX = TR.Sfx;
  const { DX, DY } = TR.Sim;
  const $ = (id) => document.getElementById(id);
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  const FACE = [0, -Math.PI / 2, Math.PI, Math.PI / 2]; // a bike riding up, right, down, left
  const COLORS = { teddy: '#2fa8ff', tommy: '#ff9f1c', foxy: '#ff4fa3', froggy: '#5ed15e' };
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const RSCALE = 0.5; // a rider on his bike (the bike and rider are then drawn BIKE times bigger)
  const BIKE = 1.7;
  const nameOf = (id) => Kit.roster.get(id).name;
  const buddyOf = (id) => Kit.roster.buddyFor(id);

  // ---------------------------------------------------------------- saved choices and the best scores
  const SAVE_KEY = 'trailRacerTT.v1';
  const saved = { diff: 'easy', hero: 'teddy', two: false, best: { easy: 0, normal: 0 } };
  try { Object.assign(saved, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* storage blocked */ }
  saved.best = Object.assign({ easy: 0, normal: 0 }, saved.best);
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch (e) { /* storage blocked */ } };

  const G = {
    screen: 'loading', two: !!saved.two, diff: saved.diff === 'normal' ? 'normal' : 'easy', hero: saved.hero === 'tommy' ? 'tommy' : 'teddy',
    M: null, demo: false, time: 0, hold: false, autoPause: true, touch: false, end: null, shake: 0, celebrate: null, goT: 0, lastCount: 0,
  };

  // ---------------------------------------------------------------- setup
  const canvas = $('game');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const FOV = 26, PITCH = (56 * Math.PI) / 180;
  const camera = new T.PerspectiveCamera(FOV, 1, 1, 500);
  scene.add(new T.HemisphereLight('#ffffff', '#5b48c9', 0.85));
  const sun = new T.DirectionalLight('#fff6e0', 0.8);
  sun.position.set(-14, 30, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  const world = A.makeWorld(scene);
  let arena = null;
  let GW = 34, GH = 24;
  const X = (x) => x - (GW - 1) / 2;
  const Z = (y) => y - (GH - 1) / 2;
  const fx = {
    stars: A.makeParticles(scene, A.starTexture(), 160),
    confetti: A.makeParticles(scene, A.squareTexture(), 220),
    puff: A.makeParticles(scene, gfx.dotTexture(), 80),
    flame: A.makeParticles(scene, gfx.dotTexture(), 160, T.AdditiveBlending),
  };
  const PASTEL = ['#ffffff', '#ffe066', '#ff9ecd', '#8fe3ff', '#a8f08a', '#d0a8ff', '#ffc38a'];
  const ring = A.makeRing(scene);
  const podium = A.makePodium();
  scene.add(podium);
  let thumbs = {};

  // ---------------------------------------------------------------- riders: a bike, a person on it, a name tag, a trail
  const views = {};
  function view(id) {
    if (views[id]) return views[id];
    const entry = Kit.roster.get(id);
    const color = COLORS[id] || '#ffffff';
    const holder = new T.Group();
    const bike = A.makeBike(color);
    const big = new T.Group(); // the toy bike, chunky: bigger than a cell
    big.scale.setScalar(BIKE);
    big.add(bike.root);
    holder.add(big);
    const p = People.build(entry.look);
    p.root.scale.setScalar(RSCALE);
    p.root.position.set(0, 0.67 - p.hipY * RSCALE, 0.1);
    p.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    bike.root.add(p.root);
    const tag = gfx.nameTag(entry.name, color);
    tag.scale.set(2.1, 0.66, 1);
    tag.position.set(0, 3.1, 0);
    holder.add(tag);
    const bubble = A.makeBubble();
    bubble.scale.set(1.4, 1.25, 1.7);
    bubble.position.y = 0.95;
    holder.add(bubble);
    holder.visible = false;
    scene.add(holder);
    const trail = A.makeTrail(scene, color, 1400);
    return (views[id] = { id, entry, color, holder, bike, p, tag, bubble, trail, ang: 0, pos: new T.Vector3(), out: 0, drawn: 0, ver: -1, round: -1, mode: '', modeT: 0, ball: null, hop: 0, inMatch: false });
  }
  // someone standing (the companion, the cup winner): built once each
  const shows = {};
  function show3d(id) {
    if (shows[id]) return shows[id];
    const entry = Kit.roster.get(id);
    const p = People.build(entry.look);
    p.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    p.root.visible = false;
    scene.add(p.root);
    return (shows[id] = { m: p, p, entry, id, mode: '', modeT: 0, ball: null });
  }

  // ---------------------------------------------------------------- comic words, particles, treats
  const words = [];
  const wordTex = {};
  function word(text, x, y, z, o = {}) {
    if (G.demo) return null;
    const t = Kit.lang.t(text);
    const key = t + '|' + (o.fill || '') + (o.stroke || '');
    const tex = wordTex[key] || (wordTex[key] = A.wordTexture(t, o.fill, o.stroke));
    let w = words.find((q) => !q.s.visible);
    if (!w) {
      w = { s: new T.Sprite(new T.SpriteMaterial({ depthWrite: false, depthTest: false, transparent: true })), t: 0 };
      w.s.renderOrder = 10;
      scene.add(w.s);
      words.push(w);
    }
    w.s.material.map = tex;
    w.s.material.needsUpdate = true;
    w.s.visible = true;
    w.s.position.set(x, y, z);
    w.t = 0;
    w.life = o.life || 1.1;
    w.size = (o.size || 1) * 5;
    w.vy = o.vy != null ? o.vy : 1.4;
    return w;
  }
  function updateWords(dt) {
    for (const w of words) {
      if (!w.s.visible) continue;
      w.t += dt;
      if (w.t >= w.life) { w.s.visible = false; continue; }
      const u = w.t / w.life;
      const pop = u < 0.15 ? 0.4 + (u / 0.15) * 0.75 : u < 0.25 ? 1.15 - (u - 0.15) : 1;
      w.s.scale.set(w.size * pop, w.size * pop * 0.3125, 1);
      w.s.position.y += w.vy * dt;
      w.s.material.opacity = u > 0.75 ? (1 - u) / 0.25 : 1;
    }
  }
  function confettiAt(x, z, n, y = 2) { fx.confetti.burst(x, y, z, n, { speed: 5, up: 7, g: 9, life: 1.7, s0: 0.32, s1: 0.22, spin: 6, colors: PASTEL, drag: 0.5 }); }
  function starsAt(x, z, n = 8, y = 1.2, colors) { fx.stars.burst(x, y, z, n, { speed: 2.6, up: 2.2, life: 0.9, s0: 0.5, s1: 0.1, spin: 5, colors: colors || ['#ffe066', '#ffffff'] }); }
  function puffAt(x, z, n = 6, y = 0.5) { fx.puff.burst(x, y, z, n, { speed: 1.6, up: 0.8, life: 0.7, s0: 0.8, s1: 2, color: '#ffffff', alpha: 0.85 }); }

  const treats = [];
  function tossTreat(from, toView) {
    const [emoji, label] = gfx.pick(TREATS);
    const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture(emoji), depthWrite: false }));
    s.scale.setScalar(1.2);
    s.position.copy(from);
    scene.add(s);
    treats.push({ s, t: 0, from: from.clone(), view: toView });
    return [emoji, label];
  }
  const tmpV = new T.Vector3();
  function updateTreats(dt) {
    for (let k = treats.length - 1; k >= 0; k--) {
      const tr = treats[k];
      tr.t += dt;
      const r = tr.view.holder;
      tmpV.set(r.position.x, r.position.y + 2.9, r.position.z);
      if (tr.t < 0.55) {
        const u = tr.t / 0.55;
        tr.s.position.lerpVectors(tr.from, tmpV, u);
        tr.s.position.y += Math.sin(u * Math.PI) * 2;
      } else {
        tr.s.position.copy(tmpV);
        tr.s.position.y += Math.sin(tr.t * 6) * 0.12;
      }
      if (tr.t > 2.4) {
        starsAt(tr.s.position.x, tr.s.position.z, 6, tr.s.position.y);
        scene.remove(tr.s);
        tr.s.material.dispose();
        treats.splice(k, 1);
      }
    }
  }
  // Teddy's jump shot: a 🏀 flies up out of his hands
  function shootBall(v, p) {
    if (v.ball) scene.remove(v.ball.s);
    const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture('🏀'), depthWrite: false }));
    s.scale.setScalar(0.9);
    p.root.updateMatrixWorld(true);
    People.handWorld(p, 1, s.position);
    scene.add(s);
    v.ball = { s, t: 0, vx: (Math.random() - 0.5) * 2, vy: 9 };
  }
  function updateBall(v, dt) {
    if (!v.ball) return;
    const b = v.ball;
    b.t += dt;
    b.vy -= 14 * dt;
    b.s.position.x += b.vx * dt;
    b.s.position.y += b.vy * dt;
    b.s.material.rotation += dt * 6;
    if (b.t > 1.3) { scene.remove(b.s); b.s.material.dispose(); v.ball = null; }
  }

  // ---------------------------------------------------------------- poses
  function turnTo(v, target, dt, rate = 16) {
    let d = target - v.ang;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    v.ang += d * damp(rate, dt);
    return d;
  }
  // his signature moves in turn, with a hop and (Teddy) a jump shot
  function celebrate(v, p, entry, t, k, dt) {
    const sig = entry.signature || ['wave'];
    const mode = sig[Math.floor(t / 1.4) % sig.length];
    if (mode !== v.mode) { v.mode = mode; v.modeT = 0; v.shot = false; }
    v.modeT += dt;
    let hop = 0;
    if (mode === 'jumpshot') {
      const u = Math.min(1, v.modeT / 0.9);
      People.pose(p, 0, 'jumpshot', k);
      hop = Math.sin(u * Math.PI) * 0.9;
      if (u > 0.45 && !v.shot) { v.shot = true; shootBall(v, p); if (!G.demo) SFX.five(); }
    } else {
      People.pose(p, mode === 'boxing' ? t * 7 : t * 6, mode, k);
      if (mode === 'peace' || mode === 'wave') hop = Math.abs(Math.sin(t * 5)) * 0.2;
    }
    return hop;
  }
  function sit(p, k, lean) {
    People.pose(p, 0, 'grab', k);
    const to = (o, prop, val) => { o[prop] += (val - o[prop]) * k; };
    to(p.legL.rotation, 'x', 1.45);
    to(p.legR.rotation, 'x', 1.45);
    to(p.armL.rotation, 'x', 1.15);
    to(p.armR.rotation, 'x', 1.15);
    to(p.hips.rotation, 'x', -0.28);
    to(p.rig.rotation, 'z', lean);
  }

  // ---------------------------------------------------------------- syncing the scene to the rules
  const tgt = new T.Vector3();
  function syncRiders(M, dt) {
    const k = damp(14, dt);
    const slow = M.slowNow();
    M.riders.forEach((r) => {
      const v = view(r.id);
      const newRound = v.round !== M.round;
      if (newRound) { v.out = 0; v.holder.visible = true; v.mode = ''; }
      const u = r.alive ? Math.min(r.u, 1) : Math.min(r.u, 0.3);
      tgt.set(X(r.x + DX[r.dir] * u), 0, Z(r.y + DY[r.dir] * u));
      const far = v.pos.distanceTo(tgt);
      if (newRound || far > 3) v.pos.copy(tgt);
      else if (far > 0.45) v.pos.lerp(tgt, damp(22, dt)); // a bubble bounce: slide back, don't jump
      else v.pos.copy(tgt);
      const turn = turnTo(v, FACE[r.dir], dt, newRound ? 1e3 : 18);
      v.bike.root.rotation.y = v.ang;
      const riding = r.alive && M.state === 'ride';
      const spd = riding ? M.speedOf(r) * (slow ? 1 / TUNE.buddy.slow : 1) : 0;
      v.bike.wheels.forEach((w) => (w.rotation.x -= spd * dt * 3.4));
      const lean = r.alive ? Math.max(-0.4, Math.min(0.4, -turn * 0.6)) : 0;
      v.bike.root.rotation.z += (lean - v.bike.root.rotation.z) * damp(10, dt);
      // the bubble shield (🐣 EASY)
      v.bubble.visible = r.alive && r.shield;
      if (v.bubble.visible) { const w = 1 + Math.sin(G.time * 5) * 0.04; v.bubble.scale.set(1.4 * w, 1.25 / w, 1.7 * w); }
      let y = 0;
      if (!r.alive) {
        // BOING: a bubble pops up round him and he floats away, a bit dizzy
        v.out += dt;
        y = v.out * v.out * 1.6;
        v.bike.root.rotation.z = Math.sin(v.out * 9) * 0.3;
        v.bubble.visible = v.out < 1.6;
        v.bubble.scale.setScalar(1.8 + Math.sin(v.out * 7) * 0.07);
        if (v.out > 1.7 && v.holder.visible) {
          v.holder.visible = false;
          starsAt(v.holder.position.x, v.holder.position.z, 6, v.holder.position.y + 0.6, ['#ffffff', COLORS[r.id]]);
        }
        sit(v.p, k, 0);
        v.p.head.rotation.z = Math.sin(v.out * 8) * 0.25;
      } else if (M.state === 'roundEnd' && M.winner === r.k) {
        // the round winner stands up on his bike and does his move
        v.p.root.position.y += (0.67 - v.p.hipY * RSCALE + 0.45 - v.p.root.position.y) * k;
        const hop = celebrate(v, v.p, v.entry, G.time, k, dt);
        y = hop * 0.6;
        v.p.root.rotation.y = Math.PI - v.ang; // face the camera
      } else {
        v.p.root.position.y += (0.67 - v.p.hipY * RSCALE - v.p.root.position.y) * k;
        v.p.root.rotation.y += (0 - v.p.root.rotation.y) * k;
        sit(v.p, k, -lean * 0.5);
        v.p.head.rotation.z = 0;
        if (v.hop > 0) { v.hop = Math.max(0, v.hop - dt); y = Math.sin((1 - v.hop / 0.5) * Math.PI) * 0.6; }
      }
      v.holder.position.set(v.pos.x, y, v.pos.z);
      updateBall(v, dt);
      // boost flames out the back
      if (riding && r.boostT > 0) {
        for (let n = 0; n < 2; n++) {
          fx.flame.emit(v.pos.x - DX[r.dir] * 1.2 + (Math.random() - 0.5) * 0.3, 0.7, v.pos.z - DY[r.dir] * 1.2 + (Math.random() - 0.5) * 0.3, {
            vx: -DX[r.dir] * 2.5, vz: -DY[r.dir] * 2.5, vy: 0.4, life: 0.4, s0: 1.0, s1: 0.15, color: n ? '#ffd400' : COLORS[r.id],
          });
        }
      }
    });
  }
  function syncTrails(M) {
    M.riders.forEach((r) => {
      const v = view(r.id);
      const tr = v.trail;
      if (v.ver !== M.trailVer || v.round !== M.round) { tr.reset(); v.drawn = 0; v.ver = M.trailVer; v.round = M.round; }
      const P = r.path, own = r.k + 1;
      for (let j = Math.max(1, v.drawn); j < P.length; j++) {
        const [a, ga] = P[j - 1], [b, gb] = P[j];
        if (M.gen[a] !== ga || M.gen[b] !== gb || M.grid[a] !== own || M.grid[b] !== own) continue;
        tr.add(X(a % M.W), Z((a / M.W) | 0), X(b % M.W), Z((b / M.W) | 0));
      }
      v.drawn = P.length;
      const last = P.length ? P[P.length - 1][0] : -1;
      if (r.alive && last >= 0 && M.grid[last] === own) tr.head(X(last % M.W), Z((last / M.W) | 0), v.pos.x, v.pos.z);
      else tr.head(0, 0, 0, 0);
      tr.alpha(r.alive ? 1 : r.fadeT > 0 ? Math.min(1, r.fadeT / TUNE.fadeT + 0.15) : 0);
      tr.flash(r.boostT > 0 ? 0.5 : 0);
    });
  }

  // the companion: floats in on a little glowing disc beside you, does his move, tosses a treat, then ZAP
  const hover = A.makeHover('#3be8ff');
  hover.visible = false;
  scene.add(hover);
  const bud = { id: null, t: 0, s: 0, owner: -1, leaving: 0 };
  function syncBuddy(M, dt) {
    const b = M.buddy;
    if (!b && !bud.id) return;
    if (b) {
      const owner = M.riders[b.owner];
      const id = buddyOf(owner.id);
      if (bud.id !== id) { if (bud.id) show3d(bud.id).p.root.visible = false; bud.id = id; bud.s = 0; }
      bud.owner = b.owner;
      bud.t = b.t;
      bud.leaving = 0;
    } else bud.leaving += dt;
    const sh = show3d(bud.id);
    const ov = view(G.M.riders[bud.owner].id);
    const target = bud.leaving > 0 ? 0 : 1;
    bud.s += (target - bud.s) * damp(12, dt);
    const sc = RSCALE * BIKE * 1.5 * (Kit.roster.get(bud.id).buddyScale || 0.8) * bud.s;
    const hx = ov.holder.position.x + 2.2, hz = ov.holder.position.z - 0.8, hy = 1.8 + Math.sin(G.time * 3) * 0.15;
    hover.position.set(hx, hy, hz);
    hover.scale.setScalar(Math.max(0.01, bud.s) * 1.5);
    hover.visible = bud.s > 0.02;
    sh.p.root.visible = bud.s > 0.02;
    sh.p.root.position.set(hx, hy + 0.1, hz);
    sh.p.root.scale.setScalar(Math.max(0.001, sc));
    sh.p.root.rotation.y = Math.PI;
    const k = damp(14, dt);
    if (bud.leaving > 0 || bud.t > TUNE.buddy.bye - 0.8) People.pose(sh.p, G.time * 7, 'wave', k);
    else if (bud.t < TUNE.buddy.treat) celebrate(sh, sh.p, sh.entry, bud.t, k, dt);
    else if (bud.t < TUNE.buddy.treat + 0.4) People.pose(sh.p, 0, 'give', k);
    else People.pose(sh.p, G.time * 6, 'peace', k);
    updateBall(sh, dt);
    if (bud.leaving > 0.4) {
      puffAt(hx, hz, 8, hy);
      sh.p.root.visible = hover.visible = false;
      bud.id = null;
    }
  }
  function hideBuddy() {
    if (bud.id) show3d(bud.id).p.root.visible = false;
    bud.id = null;
    hover.visible = false;
  }
  // the cup winner on a podium in the middle, with confetti
  function syncCelebrate(dt) {
    const c = G.celebrate;
    if (!c) { podium.visible = false; return; }
    c.t += dt;
    const sh = show3d(c.id);
    podium.visible = true;
    sh.p.root.visible = true;
    sh.p.root.scale.setScalar(Math.min(1.3, c.t * 4));
    sh.p.root.position.set(0, 0.7, 0);
    sh.p.root.rotation.y = Math.PI;
    const k = damp(14, dt);
    let hop = 0;
    if (c.wave) People.pose(sh.p, G.time * 7, 'wave', k);
    else hop = celebrate(sh, sh.p, sh.entry, c.t, k, dt);
    sh.p.root.position.y = 0.7 + hop;
    updateBall(sh, dt);
    if (c.t < 4 && Math.random() < dt * 5) confettiAt((Math.random() - 0.5) * GW * 0.7, (Math.random() - 0.5) * GH * 0.6, 14, 4);
  }
  function stopCelebrate() {
    if (G.celebrate) show3d(G.celebrate.id).p.root.visible = false;
    G.celebrate = null;
    podium.visible = false;
  }

  // ---------------------------------------------------------------- events from the rules: words, sounds, toasts
  function sfx(name, ...args) { if (!G.demo && SFX[name]) SFX[name](...args); }
  function handleEvents(M) {
    for (const e of M.events) {
      if (G.demo) continue;
      const r = e.k != null ? M.riders[e.k] : null;
      const v = r ? view(r.id) : null;
      switch (e.type) {
        case 'ready':
          G.lastCount = 0;
          setupRound(M);
          break;
        case 'go':
          G.goT = 0.8;
          sfx('beep', true);
          break;
        case 'boost':
          sfx('boost');
          word('ZOOM!', v.pos.x, 2.2, v.pos.z, { fill: '#ffd400', stroke: COLORS[r.id], size: 0.7 });
          break;
        case 'bump':
          sfx('boing');
          word('BOING!', X(e.x), 2.4, Z(e.y), { fill: '#ffffff', stroke: COLORS[r.id] });
          starsAt(X(e.x), Z(e.y), 12, 0.8, ['#ffe066', '#ffffff', COLORS[r.id]]);
          puffAt(X(e.x), Z(e.y), 6);
          if (r.human && !r.pilot) toast(`BOING! ${nameOf(r.id)} IS OUT THIS ROUND`, 'oops');
          G.shake = 0.15;
          break;
        case 'shield':
          sfx('pop');
          word('BUBBLE POP!', X(e.x), 2.4, Z(e.y), { fill: '#bff6ff', stroke: '#3be8ff', size: 0.9 });
          puffAt(X(e.x), Z(e.y), 10, 0.8);
          toast('🫧 BUBBLE SAVE!', 'good');
          break;
        case 'life': {
          const h = $('hearts');
          h.classList.remove('hit');
          void h.offsetWidth;
          h.classList.add('hit');
          break;
        }
        case 'fade': {
          sfx('fade');
          const P = r.path;
          for (let j = 0; j < P.length; j += Math.max(1, Math.floor(P.length / 14))) {
            const a = P[j][0];
            starsAt(X(a % M.W), Z((a / M.W) | 0), 2, 0.4, ['#ffffff', COLORS[r.id]]);
          }
          break;
        }
        case 'round': {
          const w = e.winner >= 0 ? M.riders[e.winner] : null;
          if (w) {
            const wv = view(w.id);
            banner(`<small>ROUND ${e.round}</small>${nameOf(w.id)} WINS!`, 'win', 2600);
            confettiAt(wv.pos.x, wv.pos.z, 40);
            sfx('round', w.human && !w.pilot);
            const card = document.querySelector(`.card[data-k="${w.k}"]`);
            if (card) { card.classList.remove('win'); void card.offsetWidth; card.classList.add('win'); }
          } else {
            banner(`<small>ROUND ${e.round}</small>TIE ROUND!`, '', 2400);
            sfx('round', false);
          }
          if (M.match) {
            const c = M.match;
            const human = M.riders.find((q) => q.human && !q.pilot);
            const id = c.winner >= 0 ? M.riders[c.winner].id : human ? human.id : 'foxy';
            G.celebrate = { id, t: 0, wave: c.kind !== 'win' };
            show3d(id).mode = '';
            if (c.kind === 'win') sfx('cup');
          }
          break;
        }
        case 'match':
          G.end = { t: 0, kind: e.kind, winner: e.winner };
          break;
        case 'buddy': {
          const bid = buddyOf(r.id);
          sfx('hello');
          toast(`${nameOf(bid)} IS HERE!`, 'buddy');
          break;
        }
        case 'treat': {
          const bid = buddyOf(r.id);
          const sh = show3d(bid);
          sh.p.root.updateMatrixWorld(true);
          const from = People.handWorld(sh.p, 1, new T.Vector3());
          const [emoji, label] = tossTreat(from, v);
          sfx('treat');
          toast(`${emoji} ${label} FROM ${nameOf(bid)}!`, 'good');
          break;
        }
        case 'zap': {
          const bid = buddyOf(r.id);
          sfx('zap');
          ring.visible = true;
          ring.position.set(X(e.x), 0.06, Z(e.y));
          ring.userData = { t: 0, R: e.R + 0.5 };
          for (let k = 0; k < 24; k++) {
            const a = (k / 24) * Math.PI * 2, d = 1 + Math.random() * e.R;
            starsAt(X(e.x) + Math.cos(a) * d, Z(e.y) + Math.sin(a) * d, 1, 0.5, ['#3be8ff', '#ffffff', '#ffd400']);
          }
          toast(`${nameOf(bid)} SAYS: ZAP! ALL CLEAR!`, 'buddy');
          G.shake = 0.12;
          break;
        }
        case 'five':
          sfx('five');
          toast('✋ HIGH FIVE! ✋', 'good');
          M.riders.forEach((q) => { if (q.human) { const qv = view(q.id); qv.hop = 0.5; starsAt(qv.pos.x, qv.pos.z, 10, 1.8); } });
          break;
        case 'cheer':
          toast(`${nameOf(buddyOf(r.id))} SAYS: YOU CAN DO IT!`, 'buddy');
          break;
      }
    }
    M.events.length = 0;
  }
  function updateRing(dt) {
    if (!ring.visible) return;
    const d = ring.userData;
    d.t += dt;
    const u = Math.min(1, d.t / 0.55);
    ring.scale.setScalar(0.3 + u * d.R);
    ring.material.opacity = d.t < 0.55 ? 0.95 : Math.max(0, 0.95 - (d.t - 0.55) * 2.5);
    if (d.t > 1) ring.visible = false;
  }

  // ---------------------------------------------------------------- the camera: the whole arena in the free space
  // Fit the arena (rim included) into the part of the screen the HUD, the kit's buttons and the touch pads leave free,
  // as big as it can be. The camera looks down from the front, never mirrored: right on the arena is right on the
  // screen, the top row is at the top.
  let CORNERS = [];
  function setCorners() {
    CORNERS = [];
    const RW = GW / 2 + A.RIM + 0.5, RH = GH / 2 + A.RIM + 0.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, 1.6]) CORNERS.push(new T.Vector3(sx * RW, y, sz * RH));
  }
  function safeRect(w, h) {
    const play = G.screen === 'play' || G.screen === 'pause';
    const bars = document.querySelector('.bars').getBoundingClientRect();
    const hud = play ? Math.max(40, bars.bottom + 4) : 8;
    const touch = G.touch && play;
    const portrait = h > w;
    const small = h < 460;
    const pad = small ? 120 : 150;
    const kb = document.getElementById('kit-help-btn'); // the kit's ? button, with the A文 and speaker under it
    const kr = kb && kb.getBoundingClientRect();
    const kitTop = kr && kr.height ? kr.top - 6 : h / 2 - 26;
    const cands = [];
    const padsTop = touch ? h - 16 - pad - 10 - (G.two ? (small ? 90 : 110) : 0) : h - 8;
    cands.push({ l: 8, r: 8, t: hud, b: Math.min(kitTop, portrait ? padsTop : h - 8) }); // above the kit buttons
    if (touch && !portrait) {
      const side = 64 + pad + 10, sideR = G.two ? 16 + pad + 10 : 18 + (small ? 88 : 104) + 14;
      const m = Math.max(side, sideR);
      cands.push({ l: m, r: m, t: hud, b: h - 8 });
    } else cands.push({ l: 58, r: 58, t: hud, b: portrait ? padsTop : h - 8 });
    if (!touch && play && !G.two) cands[1].r = cands[1].l = Math.max(cands[1].l, 128); // the big companion button
    let best = null, bs = 0;
    const RW = GW / 2 + A.RIM, RH = GH / 2 + A.RIM;
    for (const c of cands) {
      const sw = w - c.l - c.r, sh = c.b - c.t;
      if (sw < 40 || sh < 40) continue;
      const s = Math.min(sw / (RW * 2), sh / (RH * 2 * 0.85));
      if (s > bs) { bs = s; best = c; }
    }
    return best || { l: 0, r: 0, t: 0, b: h };
  }
  const pv = new T.Vector3();
  function fit() {
    const w = innerWidth || 800, h = innerHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.clearViewOffset();
    const r = safeRect(w, h);
    const sw = (w - r.l - r.r) * 0.97, sh = (r.b - r.t) * 0.97;
    let d = 60, box = null;
    for (let iter = 0; iter < 8; iter++) {
      camera.position.set(0, d * Math.sin(PITCH), d * Math.cos(PITCH));
      camera.lookAt(0, 0, 0);
      camera.near = Math.max(1, d - 70);
      camera.far = d + 300;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      box = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
      for (const c of CORNERS) {
        pv.copy(c).project(camera);
        box.x0 = Math.min(box.x0, pv.x); box.x1 = Math.max(box.x1, pv.x);
        box.y0 = Math.min(box.y0, pv.y); box.y1 = Math.max(box.y1, pv.y);
      }
      const k = Math.max(((box.x1 - box.x0) / 2) * w / sw, ((box.y1 - box.y0) / 2) * h / sh);
      if (Math.abs(k - 1) < 0.002) break;
      d *= k;
    }
    const cx = ((box.x0 + box.x1) / 2 + 1) / 2 * w, cy = (1 - (box.y0 + box.y1) / 2) / 2 * h;
    const tx = r.l + (w - r.l - r.r) / 2, ty = r.t + (r.b - r.t) / 2;
    camera.setViewOffset(w, h, cx - tx, cy - ty, w, h);
    camera.updateProjectionMatrix();
    G.camPos = camera.position.clone();
    G.fitKey = fitKey();
  }
  const fitKey = () => (innerWidth || 800) + 'x' + (innerHeight || 600) + G.screen + G.touch + G.two + GW + 'x' + GH;
  function refit() { if (G.fitKey !== fitKey()) fit(); }
  const proj = new T.Vector3();
  // where a grid position is on the screen, in CSS pixels
  function toScreen(x, y, h = 0) {
    camera.updateMatrixWorld();
    proj.set(X(x), h, Z(y)).project(camera);
    return { x: (proj.x + 1) / 2 * (innerWidth || 800), y: (1 - proj.y) / 2 * (innerHeight || 600) };
  }

  // ---------------------------------------------------------------- HUD
  const cacheText = {};
  const setText = (el, key, v) => { if (cacheText[key] !== v) { cacheText[key] = v; el.textContent = v; } };
  function toast(text, cls) {
    if (G.demo) return;
    const box = $('toasts');
    while (box.children.length > 2) box.firstChild.remove();
    const d = document.createElement('div');
    d.className = 'toast' + (cls ? ' ' + cls : '');
    d.textContent = text;
    box.appendChild(d);
    setTimeout(() => d.remove(), 2300);
  }
  let bannerTimer = 0;
  function banner(html, cls, ms) {
    const b = $('banner');
    b.innerHTML = html;
    b.className = 'banner show pop' + (cls ? ' ' + cls : '');
    clearTimeout(bannerTimer);
    if (ms) bannerTimer = setTimeout(hideBanner, ms);
  }
  function hideBanner() { $('banner').className = 'banner'; }
  function humanOf(M) { return M.riders.filter((r) => r.human && !r.pilot); }
  function setupHud(M) {
    const L = $('sideL'), R = $('sideR');
    L.textContent = '';
    R.textContent = '';
    M.riders.forEach((r) => {
      const c = document.createElement('div');
      c.className = 'card';
      c.dataset.k = r.k;
      c.style.setProperty('--c', COLORS[r.id]);
      const pips = '<i></i>'.repeat(TUNE.winRounds);
      c.innerHTML = `<div class="face" data-k="${r.k}"><img alt=""></div><div class="col"><span class="nm"></span><span class="pips">${pips}</span>${r.human ? '<span class="pts">0</span><span class="bst"><b></b></span>' : ''}</div>`;
      c.querySelector('img').src = thumbs[r.id] || '';
      c.querySelector('.nm').textContent = nameOf(r.id);
      (r.human ? L : R).appendChild(c);
      c.querySelector('.face').addEventListener('pointerdown', () => { if (G.screen === 'play' && r.human) callBuddy(G.two ? r.k : 0); });
    });
    for (const k in cacheText) delete cacheText[k];
    $('hearts').style.display = M.lives === null ? 'none' : '';
    $('score').style.display = M.two ? 'none' : '';
    const h = humanOf(M)[0];
    if (h && !M.two) {
      const bid = buddyOf(h.id);
      const b = $('budBtn');
      b.querySelector('img').src = thumbs[bid] || '';
      b.querySelector('small').textContent = nameOf(bid);
      b.style.background = bid === 'tommy' ? 'radial-gradient(circle at 50% 35%, #ffe2a0, #ff9f1c)' : 'radial-gradient(circle at 50% 35%, #a5dcff, #2a7bd6)';
    }
    document.body.classList.toggle('two', M.two);
  }
  function setupRound(M) {
    document.querySelectorAll('.card').forEach((c) => c.classList.remove('out'));
    G.goT = 0;
  }
  function updateHud(M) {
    M.riders.forEach((r) => {
      const c = document.querySelector(`.card[data-k="${r.k}"]`);
      if (!c) return;
      const key = 'c' + r.k;
      const state = `${r.wins}|${r.alive}|${r.score}|${r.boostT > 0 ? 'b' : r.coolT > 0 ? Math.round(r.coolT * 10) : 'r'}`;
      if (cacheText[key] === state) return;
      cacheText[key] = state;
      c.querySelectorAll('.pips i').forEach((p, j) => p.classList.toggle('on', j < r.wins));
      c.classList.toggle('out', !r.alive);
      const pts = c.querySelector('.pts');
      if (pts) pts.textContent = String(r.score);
      const bar = c.querySelector('.bst b');
      if (bar) bar.style.width = `${Math.round(100 * (r.boostT > 0 ? r.boostT / TUNE.boost.time : 1 - r.coolT / TUNE.boost.cool))}%`;
      if (r.human && !r.pilot) {
        const btn = $('act' + (M.two ? r.k : 0));
        btn.style.setProperty('--charge', (r.boostT > 0 ? r.boostT / TUNE.boost.time : 1 - r.coolT / TUNE.boost.cool).toFixed(2));
      }
    });
    setText($('roundChip'), 'round', `ROUND ${M.round}`);
    const hs = humanOf(M);
    const score = hs.length ? Math.max(...hs.map((r) => r.score)) : 0;
    setText($('score'), 'score', `SCORE ${score}`);
    setText($('hi'), 'hi', `HI-SCORE ${Math.max(saved.best[M.diff] || 0, score)}`);
    if (M.lives !== null) setText($('hearts'), 'hearts', '❤️'.repeat(M.lives) + '🤍'.repeat(Math.max(0, M.D.lives - M.lives)));
    $('budBtn').classList.toggle('on', !!M.buddy);
    $('slow').classList.toggle('on', M.slowNow());
    // 3, 2, 1, GO!
    if (M.state === 'ready') {
      const n = Math.max(1, Math.ceil((TUNE.readyT - M.readyT) / (TUNE.readyT / 3)));
      if (n !== G.lastCount) {
        G.lastCount = n;
        banner(`<small>ROUND ${M.round}</small>${n}`, '', 0);
        sfx('beep', false);
      }
    } else if (M.state === 'ride' && G.goT > 0) {
      if (G.lastCount !== 'go') { G.lastCount = 'go'; banner('GO!', '', 700); }
    }
  }

  // ---------------------------------------------------------------- screens and the flow of a game
  const SCREENS = ['title', 'pause', 'results'];
  function show(name) {
    G.screen = name;
    SCREENS.forEach((s) => $(s).classList.toggle('hidden', s !== name));
    const playing = name === 'play' || name === 'pause';
    $('hud').classList.toggle('hidden', !playing);
    $('budBtn').classList.toggle('hidden', !(name === 'play' && !G.two));
    document.body.classList.toggle('playing', playing);
    document.body.classList.toggle('two', G.two && playing);
    if (name !== 'play') $('slow').classList.remove('on');
    fit();
  }
  function renderTitle() {
    document.querySelectorAll('.lvl').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === G.diff)));
    document.querySelectorAll('.hero').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.hero === G.hero)));
    $('mode1').classList.toggle('pulse', !G.two);
    $('mode2').classList.toggle('pulse', G.two);
    document.body.classList.toggle('two-on', G.two);
  }
  function setLogo() { $('logoMain').textContent = Kit.lang.is('zh') ? TR.ZH : TR.TITLE.toUpperCase(); }
  const portraitNow = () => (innerHeight || 600) > (innerWidth || 800) * 1.05;
  // a phone gets a smaller arena (EASY's is still the bigger one), so the cells stay big enough to see
  const phone = () => Math.min(innerWidth || 800, innerHeight || 600) < 500;
  const arenaSize = (diff) => (phone() ? { W: Math.round(TUNE[diff].W * TUNE.phone), H: Math.round(TUNE[diff].H * TUNE.phone) } : {});
  function riderList(two, hero) {
    if (two) return [{ id: 'teddy', human: true }, { id: 'tommy', human: true }, { id: 'foxy' }, { id: 'froggy' }];
    return [{ id: hero, human: true }, { id: 'foxy' }, { id: 'froggy' }];
  }
  function useMatch(M) {
    for (const id in views) { views[id].holder.visible = false; views[id].trail.reset(); views[id].trail.head(0, 0, 0, 0); views[id].round = -1; }
    G.M = M;
    if (!arena || arena.W !== M.W || arena.H !== M.H) {
      if (arena) arena.dispose();
      arena = A.makeArena(scene, M.W, M.H);
    }
    GW = M.W;
    GH = M.H;
    world.place(GW, GH);
    setCorners();
    hideBuddy();
    stopCelebrate();
    ring.visible = false;
    M.riders.forEach((r) => { const v = view(r.id); v.holder.visible = true; v.out = 0; });
    fit();
  }
  function startDemo() {
    G.demo = true;
    const M = TR.Sim.create(Object.assign({ diff: 'normal', portrait: portraitNow(), seed: (Math.random() * 1e9) | 0, riders: [{ id: 'teddy' }, { id: 'tommy' }, { id: 'foxy' }, { id: 'froggy' }] }, arenaSize('normal')));
    M.readyT = TUNE.readyT - 0.4;
    useMatch(M);
  }
  function titleScreen() {
    G.end = null;
    $('toasts').textContent = '';
    hideBanner();
    show('title');
    renderTitle();
    startDemo();
    Kit.sound.music('title');
  }
  function startGame(two, o = {}) {
    Kit.sound.init();
    G.two = !!two;
    I.two = G.two;
    I.clear();
    saved.two = G.two;
    persist();
    G.demo = false;
    G.end = null;
    $('toasts').textContent = '';
    hideBanner();
    const M = TR.Sim.create(Object.assign({
      diff: G.diff, two: G.two, portrait: o.portrait != null ? o.portrait : portraitNow(),
      seed: o.seed != null ? o.seed : (Math.random() * 1e9) | 0, riders: riderList(G.two, G.hero),
    }, o.full ? {} : arenaSize(G.diff)));
    show('play');
    useMatch(M);
    setupHud(M);
    handleEvents(M);
    Kit.sound.music('play');
  }
  function finish() {
    const M = G.M, e = G.end;
    const hs = humanOf(M);
    const w = e.winner >= 0 ? M.riders[e.winner] : null;
    let newBest = false;
    for (const h of hs) if (h.score > (saved.best[M.diff] || 0)) { saved.best[M.diff] = h.score; newBest = true; }
    persist();
    const faceId = w ? w.id : hs[0] ? hs[0].id : 'foxy';
    $('resFace').src = thumbs[faceId] || '';
    $('resTitle').textContent = w ? `${nameOf(w.id)} WINS THE CUP!` : 'GOOD TRY!';
    $('resSub').textContent = e.kind === 'win' ? 'First to 5 rounds!' : e.kind === 'cpu' ? 'Good race! Play again?' : 'Out of lives. Try again!';
    const st = $('resStats');
    st.textContent = '';
    const row = (label, val, isNew) => {
      const d = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = label;
      d.appendChild(b);
      d.appendChild(document.createTextNode(val));
      if (isNew) { const n = document.createElement('span'); n.className = 'new'; n.textContent = ' NEW!'; d.appendChild(n); }
      st.appendChild(d);
    };
    for (const h of hs) row(M.two ? `${nameOf(h.id)} SCORE` : 'SCORE', String(h.score), newBest && h.score === saved.best[M.diff]);
    row('HI-SCORE', String(saved.best[M.diff] || 0));
    row('ROUNDS', M.riders.map((r) => `${nameOf(r.id)} ${r.wins}`).join(' · '));
    show('results');
    Kit.sound.music('over');
  }
  function again() { startGame(G.two); }
  function pause(on) {
    if (on && G.screen !== 'play') return;
    if (!on && G.screen !== 'pause') return;
    I.clear();
    show(on ? 'pause' : 'play');
    Kit.sound.music(on ? 'pause' : 'play');
  }
  function toMenu() { I.clear(); titleScreen(); }
  function callBuddy(i) {
    if (!G.M || G.demo || G.screen !== 'play') return false;
    Kit.sound.init();
    const ok = G.M.callBuddy(i);
    handleEvents(G.M); // its news (he's here, or a high five) comes between frames: show it now
    return ok;
  }
  function turn(i, d) {
    const M = G.M;
    if (!M || G.demo || G.screen !== 'play') return false;
    const ok = M.turn(i, d);
    if (ok) sfx('turn');
    return ok;
  }
  function boost(i) {
    const M = G.M;
    if (!M || G.demo || G.screen !== 'play') return false;
    const ok = M.boost(i);
    handleEvents(M);
    return ok;
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (G.hold || G.screen === 'loading') return;
    tick(dt);
    draw();
  }
  function logic(dt) {
    const M = G.M;
    if (!M) return;
    if (G.screen === 'play') {
      M.step(dt);
      handleEvents(M);
      if (G.goT > 0) G.goT -= dt;
      if (G.end) { G.end.t += dt; if (G.end.t > 0.6) finish(); }
    } else if (G.screen === 'title' && G.demo) {
      M.step(dt);
      M.events.length = 0;
      if (M.state === 'matchEnd' || M.round > 3) startDemo();
    }
  }
  function tick(dt) {
    G.time += dt;
    logic(dt);
    const M = G.M;
    if (M) {
      syncRiders(M, dt);
      syncTrails(M);
      syncBuddy(M, dt);
      if (G.screen === 'play' || G.screen === 'pause') updateHud(M);
    }
    syncCelebrate(dt);
    updateTreats(dt);
    updateWords(dt);
    updateRing(dt);
    Object.values(fx).forEach((f) => f.update(dt));
    world.update(G.time);
    if (arena) arena.update(G.time);
  }
  function draw() {
    refit();
    G.shake = Math.max(0, G.shake - 1 / 60);
    const s = G.shake * 0.8;
    if (G.camPos) camera.position.set(G.camPos.x + (s ? (Math.random() - 0.5) * s : 0), G.camPos.y, G.camPos.z + (s ? (Math.random() - 0.5) * s : 0));
    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------- input
  function setTouch(on) {
    if (G.touch === on) return;
    G.touch = on;
    document.body.classList.toggle('touch', on);
    fit();
  }
  function muteIcon() { document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊')); }
  function toggleMute() { Kit.sound.init(); Kit.sound.toggleMute(); muteIcon(); }
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const code = e.code;
    if (code === 'KeyM') { if (!e.repeat) toggleMute(); return; }
    if (G.screen === 'play') {
      if (code === 'KeyP' || code === 'Escape') { e.preventDefault(); pause(true); return; }
      if (code === 'KeyT') { e.preventDefault(); if (!e.repeat) callBuddy(0); return; }
      if (!I.isGameKey(code)) return;
      e.preventDefault();
      const a = I.down(code);
      if (!a || e.repeat) return;
      Kit.sound.init();
      if (a.boost) boost(a.who);
      else turn(a.who, a.dir);
      return;
    }
    if (e.repeat) return;
    if (G.screen === 'pause') {
      e.preventDefault();
      if (code === 'KeyP' || code === 'Escape' || code === 'Space' || code === 'Enter') pause(false);
      else if (code === 'KeyQ') toMenu();
      return;
    }
    if (G.screen === 'title') {
      if (code === 'ArrowLeft' || code === 'ArrowRight') { G.two = code === 'ArrowRight'; renderTitle(); }
      else if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'KeyW' || code === 'KeyS') { G.diff = G.diff === 'easy' ? 'normal' : 'easy'; saved.diff = G.diff; persist(); renderTitle(); }
      else if (code === 'KeyA' || code === 'KeyD') { G.hero = G.hero === 'teddy' ? 'tommy' : 'teddy'; saved.hero = G.hero; persist(); renderTitle(); }
      else if (code === 'Digit1') startGame(false);
      else if (code === 'Digit2') startGame(true);
      else if (code === 'Enter' || code === 'Space') startGame(G.two);
      else return;
      e.preventDefault();
      return;
    }
    if (G.screen === 'results') {
      if (code === 'Enter' || code === 'Space') { e.preventDefault(); again(); }
      else if (code === 'Escape' || code === 'KeyQ') { e.preventDefault(); toMenu(); }
    }
  }
  function padDirOf(el, e) {
    const r = el.getBoundingClientRect();
    return I.padDir(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width);
  }
  function wire() {
    addEventListener('keydown', onKey);
    addEventListener('keyup', (e) => I.up(e.code));
    addEventListener('blur', () => I.clear());
    addEventListener('resize', fit);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      I.clear();
      if (G.screen === 'play' && G.autoPause) pause(true);
    });
    addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') setTouch(true); Kit.sound.init(); }, true);
    $('mode1').addEventListener('click', () => startGame(false));
    $('mode2').addEventListener('click', () => startGame(true));
    document.querySelectorAll('.lvl').forEach((b) => b.addEventListener('click', () => { G.diff = b.dataset.level; saved.diff = G.diff; persist(); renderTitle(); }));
    document.querySelectorAll('.hero').forEach((b) => b.addEventListener('click', () => { G.hero = b.dataset.hero; saved.hero = G.hero; persist(); renderTitle(); }));
    $('pauseBtn').addEventListener('click', () => pause(true));
    $('resumeBtn').addEventListener('click', () => pause(false));
    $('quitBtn').addEventListener('click', toMenu);
    $('againBtn').addEventListener('click', again);
    $('menuBtn').addEventListener('click', toMenu);
    document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', toggleMute));
    Kit.sound.onMute(muteIcon);
    const budBtn = $('budBtn');
    budBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); budBtn.classList.add('down'); callBuddy(0); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) budBtn.addEventListener(ev, () => budBtn.classList.remove('down'));
    [0, 1].forEach((i) => {
      const pad = $('pad' + i), btn = $('act' + i);
      const who = () => (G.two ? i : 0);
      // a tap turns that way; sliding the finger round to another side turns again
      let lastDir = -1, finger = null;
      const set = (d) => { pad.dataset.dir = String(d); if (d >= 0 && d !== lastDir) turn(who(), d); lastDir = d; };
      pad.addEventListener('pointerdown', (e) => { e.preventDefault(); finger = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } lastDir = -1; Kit.sound.init(); set(padDirOf(pad, e)); });
      pad.addEventListener('pointermove', (e) => { if (e.pointerId === finger) set(padDirOf(pad, e)); });
      const lift = (e) => { if (e.pointerId !== finger) return; finger = null; pad.dataset.dir = '-1'; lastDir = -1; };
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(ev, lift);
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.classList.add('down'); Kit.sound.init(); boost(who()); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, () => btn.classList.remove('down'));
    });
    Kit.lang.onChange(() => { setLogo(); for (const k in wordTex) { wordTex[k].dispose(); delete wordTex[k]; } });
  }

  function boot() {
    thumbs = Kit.portraits(['teddy', 'tommy', 'foxy', 'froggy'].map((id) => Kit.roster.get(id)), { size: 160 });
    document.querySelectorAll('.hero').forEach((b) => (b.querySelector('img').src = thumbs[b.dataset.hero] || ''));
    $('tagline').textContent = TR.SUBTITLE;
    setLogo();
    wire();
    muteIcon();
    if (/[?&]touch=1/.test(location.search) || (window.matchMedia && matchMedia('(pointer: coarse)').matches)) setTouch(true);
    $('loading').remove();
    titleScreen();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- test hooks (window.game)
  const STEP = 1 / 60;
  window.game = {
    // start racing straight away: game.start({ two, diff, hero, portrait, seed, skipReady })
    start(o = {}) {
      if (o.diff) G.diff = o.diff;
      if (o.hero) G.hero = o.hero;
      startGame(!!o.two, o);
      if (o.skipReady) { G.M.readyT = TUNE.readyT; G.M.step(1 / TUNE.HZ); handleEvents(G.M); hideBanner(); G.goT = 0; }
      return this.info();
    },
    // run the game for this many seconds (the same frame code as the real loop, keys included)
    step(secs = STEP, o = {}) {
      const n = Math.max(1, Math.round(secs / STEP));
      for (let k = 0; k < n; k++) tick(STEP);
      if (o.draw !== false) draw();
      return this.info();
    },
    hold(on = true) { G.hold = on; last = performance.now(); },
    autoPause(on) { G.autoPause = on; },
    check: () => TR.Checks.all(),
    prove: () => TR.Checks.prove(),
    get M() { return G.M; },
    get G() { return G; },
    get renderer() { return renderer; },
    screen: () => G.screen,
    toScreen,
    // where rider k's bike is drawn on the screen, in CSS pixels (the picture, not the rules)
    riderScreen(k) {
      const v = views[G.M.riders[k].id];
      v.holder.updateMatrixWorld(true);
      camera.updateMatrixWorld();
      proj.set(v.holder.position.x, 0, v.holder.position.z).project(camera);
      return { x: (proj.x + 1) / 2 * (innerWidth || 800), y: (1 - proj.y) / 2 * (innerHeight || 600) };
    },
    menu: toMenu,
    again,
    pause,
    callBuddy,
    setTouch,
    fit,
    info() {
      const M = G.M;
      return {
        screen: G.screen, two: G.two, diff: G.diff, state: M && M.state, round: M && M.round, lives: M && M.lives, W: M && M.W, H: M && M.H,
        lang: Kit.lang.get(), buddy: !!(M && M.buddy), slow: !!(M && M.slowNow()),
        riders: M ? M.riders.map((r) => ({ id: r.id, x: r.x, y: r.y, dir: r.dir, u: +r.u.toFixed(2), alive: r.alive, wins: r.wins, score: r.score, shield: r.shield })) : [],
      };
    },
  };
  boot();
})();
