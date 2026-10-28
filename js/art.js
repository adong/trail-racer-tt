/* The look of TT Trail Racer, all made in code (no image files): a glowing toy arena with a neon grid and candy rim,
   chunky toy light bikes, glowing trail walls, bubbles, the ZAP ring, comic words and particles.
   One cell of the grid is one unit; the arena sits at the middle of the world, the bikes face -z when they ride up. */
(function () {
  'use strict';
  const T = THREE;
  const gfx = Kit.gfx;
  const RIM = 0.7, WALL_H = 0.55, WALL_T = 0.22;

  // the world around the arena: a soft purple evening with twinkly toy lights far below
  function makeWorld(scene) {
    scene.background = new T.Color('#2a2366');
    const [c, g] = gfx.makeCanvas(512, 512);
    const grad = g.createRadialGradient(256, 256, 30, 256, 256, 256);
    grad.addColorStop(0, '#5b48c9');
    grad.addColorStop(0.55, '#3a2d8f');
    grad.addColorStop(1, '#2a2366');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
    const ground = new T.Mesh(new T.PlaneGeometry(260, 260), new T.MeshBasicMaterial({ map: gfx.toTexture(c) }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3;
    scene.add(ground);
    // twinkly toy lights on the ground: sharp little points (one draw call)
    const cols = ['#ffd400', '#3be8ff', '#ff4fa3', '#ffffff', '#8cff8c'].map((h) => new T.Color(h));
    const n = 420, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 90;
      pos.set([Math.cos(a) * r, -2.9, Math.sin(a) * r], k * 3);
      cols[k % cols.length].toArray(col, k * 3);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    const lights = new T.Points(geo, new T.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false }));
    scene.add(lights);
    // floating balloons and stars round the edge, gently bobbing
    const deco = [];
    const icons = ['🎈', '⭐', '🎈', '✨', '🎈', '⭐'];
    for (let k = 0; k < 14; k++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture(icons[k % icons.length]), depthWrite: false }));
      s.scale.setScalar(1.8 + Math.random() * 0.8);
      scene.add(s);
      deco.push({ s, a: (k / 14) * Math.PI * 2, ph: Math.random() * 6 });
    }
    return {
      deco,
      // put the decorations just outside an arena this big
      place(w, h) {
        for (const d of deco) {
          // on a rounded box just outside the rim, never over the arena
          const cx = Math.cos(d.a), cz = Math.sin(d.a);
          const k = 1 / Math.max(Math.abs(cx) / (w / 2 + 4.5), Math.abs(cz) / (h / 2 + 4.5));
          d.x = cx * k;
          d.z = cz * k;
        }
      },
      update(t) {
        for (const d of deco) d.s.position.set(d.x || 0, 0.6 + Math.sin(t * 1.3 + d.ph) * 0.4, d.z || 0);
      },
    };
  }

  // the floor's neon grid, drawn once per arena size
  function gridTexture(W, H) {
    const px = 24;
    const [c, g] = gfx.makeCanvas(W * px, H * px);
    g.fillStyle = '#3b2f9a';
    g.fillRect(0, 0, W * px, H * px);
    // soft lighter tiles in a checker, so the cells are easy to count
    g.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 2) g.fillRect(x * px, y * px, px, px);
    for (let x = 0; x <= W; x++) {
      g.fillStyle = x % 5 === 0 ? 'rgba(120,240,255,0.55)' : 'rgba(120,240,255,0.22)';
      g.fillRect(x * px - 1, 0, 2, H * px);
    }
    for (let y = 0; y <= H; y++) {
      g.fillStyle = y % 5 === 0 ? 'rgba(120,240,255,0.55)' : 'rgba(120,240,255,0.22)';
      g.fillRect(0, y * px - 1, W * px, 2);
    }
    const tex = gfx.toTexture(c);
    tex.anisotropy = 4;
    return tex;
  }
  function stripeTexture() {
    const [c, g] = gfx.makeCanvas(64, 16);
    g.fillStyle = '#ff4fa3';
    g.fillRect(0, 0, 64, 16);
    g.fillStyle = '#ffffff';
    for (let x = -16; x < 64; x += 16) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 8, 0); g.lineTo(x + 14, 0); g.lineTo(x + 6, 16); g.fill(); }
    const t = gfx.toTexture(c);
    t.wrapS = T.RepeatWrapping;
    return t;
  }

  // the arena for a W x H grid: floor, glowing candy-striped rim and corner posts with light balls
  function makeArena(scene, W, H) {
    const group = new T.Group();
    const disposables = [];
    const own = (o) => { disposables.push(o); return o; };
    const floorTex = own(gridTexture(W, H));
    const floor = new T.Mesh(own(new T.BoxGeometry(W, 0.4, H)), own(new T.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.05 })));
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    group.add(floor);
    const base = new T.Mesh(own(new T.BoxGeometry(W + RIM * 2 + 1.2, 1.2, H + RIM * 2 + 1.2)), own(gfx.std('#5a3fd6', { roughness: 0.6 })));
    base.position.y = -0.95;
    base.receiveShadow = true;
    group.add(base);
    const under = new T.Mesh(own(new T.BoxGeometry(W + RIM * 2 + 1.6, 0.3, H + RIM * 2 + 1.6)), own(new T.MeshBasicMaterial({ color: '#3be8ff' })));
    under.position.y = -1.45;
    group.add(under);
    const stripe = own(stripeTexture());
    const rimMat = own(new T.MeshStandardMaterial({ map: stripe, emissive: '#ff4fa3', emissiveIntensity: 0.35, roughness: 0.4 }));
    const glowMat = own(new T.MeshBasicMaterial({ color: '#3be8ff' }));
    // [length, x, z, turned, where the glowing line on its inside edge goes]
    const sides = [
      [W + RIM * 2, 0, H / 2 + RIM / 2, 0, [0, H / 2 + 0.07]], [W + RIM * 2, 0, -H / 2 - RIM / 2, 0, [0, -H / 2 - 0.07]],
      [H, W / 2 + RIM / 2, 0, Math.PI / 2, [W / 2 + 0.07, 0]], [H, -W / 2 - RIM / 2, 0, Math.PI / 2, [-W / 2 - 0.07, 0]],
    ];
    for (const [len, x, z, rot, edge] of sides) {
      const geo = own(new T.BoxGeometry(len, 0.6, RIM));
      const tex = stripe.clone();
      tex.needsUpdate = true;
      tex.repeat.set(len / 2, 1);
      own(tex);
      const mat = own(rimMat.clone());
      mat.map = tex;
      const m = new T.Mesh(geo, mat);
      m.position.set(x, 0.3, z);
      m.rotation.y = rot;
      m.castShadow = true;
      group.add(m);
      // a glowing line along the inside top edge
      const line = new T.Mesh(own(new T.BoxGeometry(len, 0.08, 0.12)), glowMat);
      line.position.set(edge[0], 0.62, edge[1]);
      line.rotation.y = rot;
      group.add(line);
    }
    const ballMats = ['#ffd400', '#3be8ff', '#8cff8c', '#ff9ecd'].map((col) => own(new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8, roughness: 0.3 })));
    const postGeo = own(new T.CylinderGeometry(0.55, 0.65, 1.1, 16));
    const ballGeo = own(new T.SphereGeometry(0.5, 18, 12));
    const postMat = own(gfx.std('#ffffff', { roughness: 0.4 }));
    const balls = [];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], k) => {
      const p = new T.Mesh(postGeo, postMat);
      p.position.set(sx * (W / 2 + RIM / 2), 0.55, sz * (H / 2 + RIM / 2));
      p.castShadow = true;
      group.add(p);
      const b = new T.Mesh(ballGeo, ballMats[k]);
      b.position.set(p.position.x, 1.45, p.position.z);
      group.add(b);
      balls.push(b);
    });
    scene.add(group);
    return {
      group, W, H,
      update(t) { balls.forEach((b, k) => { b.position.y = 1.45 + Math.sin(t * 3 + k) * 0.12; b.material.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 4 + k * 1.7); }); },
      dispose() { scene.remove(group); disposables.forEach((d) => d.dispose && d.dispose()); },
    };
  }

  // a chunky toy light bike, nose toward -z, about 1.5 cells long
  function makeBike(color) {
    const root = new T.Group();
    const body = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.18, roughness: 0.35, metalness: 0.1 });
    const white = gfx.std('#ffffff', { roughness: 0.35 });
    const dark = gfx.std('#262340', { roughness: 0.6 });
    const glow = new T.MeshBasicMaterial({ color: gfx.shade(color, 0.35) });
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; root.add(m); return m; };
    add(new T.BoxGeometry(0.46, 0.3, 1.2), body, 0, 0.42, 0);
    add(new T.BoxGeometry(0.4, 0.28, 0.42), white, 0, 0.5, -0.6);
    add(new T.BoxGeometry(0.42, 0.22, 0.34), body, 0, 0.58, 0.55);
    add(new T.BoxGeometry(0.3, 0.1, 0.5), dark, 0, 0.62, 0.12); // the seat
    add(new T.BoxGeometry(0.66, 0.07, 0.07), dark, 0, 0.82, -0.45); // handlebars
    add(new T.BoxGeometry(0.07, 0.3, 0.07), dark, 0, 0.66, -0.45);
    const lamp = add(new T.SphereGeometry(0.11, 12, 8), new T.MeshBasicMaterial({ color: '#fffbe0' }), 0, 0.52, -0.83);
    lamp.castShadow = false;
    add(new T.BoxGeometry(0.34, 0.08, 0.04), glow, 0, 0.6, 0.73);
    const wheels = [];
    for (const z of [-0.55, 0.55]) {
      const w = new T.Group();
      w.position.set(0, 0.3, z);
      const tyre = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.24, 18), dark);
      tyre.rotation.z = Math.PI / 2;
      tyre.castShadow = true;
      w.add(tyre);
      const ring = new T.Mesh(new T.TorusGeometry(0.27, 0.05, 8, 24), glow);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = 0.13;
      w.add(ring);
      const ring2 = ring.clone();
      ring2.position.x = -0.13;
      w.add(ring2);
      const spoke = new T.Mesh(new T.BoxGeometry(0.26, 0.5, 0.06), white);
      w.add(spoke);
      root.add(w);
      wheels.push(w);
    }
    return { root, wheels, body, glow };
  }

  // one rider's trail: glowing wall segments between cell centres (instanced), with a soft glow on the floor
  const SEG = new T.BoxGeometry(1, WALL_H, WALL_T);
  SEG.translate(0, WALL_H / 2, 0);
  const GLOW = new T.PlaneGeometry(1, 0.95);
  GLOW.rotateX(-Math.PI / 2);
  let bandTex = null;
  function band() {
    if (bandTex) return bandTex;
    const [c, g] = gfx.makeCanvas(8, 64);
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 64);
    return (bandTex = gfx.toTexture(c));
  }
  function makeTrail(scene, color, cap) {
    const wallMat = new T.MeshStandardMaterial({ color: gfx.shade(color, 0.15), emissive: color, emissiveIntensity: 0.7, roughness: 0.35, transparent: true, opacity: 0.9 });
    const glowMat = new T.MeshBasicMaterial({ map: band(), color, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending });
    const walls = new T.InstancedMesh(SEG, wallMat, cap);
    const glows = new T.InstancedMesh(GLOW, glowMat, cap);
    walls.count = glows.count = 0;
    walls.castShadow = true;
    walls.frustumCulled = glows.frustumCulled = false;
    glows.position.y = 0.015;
    glows.renderOrder = 1;
    scene.add(walls, glows);
    const head = new T.Mesh(SEG, wallMat);
    head.castShadow = true;
    const headGlow = new T.Mesh(GLOW, glowMat);
    headGlow.position.y = 0.015;
    scene.add(head, headGlow);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), s = new T.Vector3(), up = new T.Vector3(0, 1, 0);
    function seg(x1, z1, x2, z2, out) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      q.setFromAxisAngle(up, Math.abs(x2 - x1) >= Math.abs(z2 - z1) ? 0 : Math.PI / 2);
      v.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
      s.set(len + WALL_T, 1, 1);
      return out.compose(v, q, s);
    }
    return {
      n: 0,
      reset() { this.n = walls.count = glows.count = 0; walls.instanceMatrix.needsUpdate = glows.instanceMatrix.needsUpdate = true; },
      add(x1, z1, x2, z2) {
        if (this.n >= cap) return;
        seg(x1, z1, x2, z2, m4);
        walls.setMatrixAt(this.n, m4);
        s.set(Math.hypot(x2 - x1, z2 - z1) + 0.4, 1, 1);
        m4.compose(v, q, s);
        glows.setMatrixAt(this.n, m4);
        this.n++;
        walls.count = glows.count = this.n;
        walls.instanceMatrix.needsUpdate = glows.instanceMatrix.needsUpdate = true;
      },
      // the growing piece from the last cell to the bike
      head(x1, z1, x2, z2) {
        const len = Math.hypot(x2 - x1, z2 - z1);
        head.visible = headGlow.visible = len > 0.02;
        if (!head.visible) return;
        seg(x1, z1, x2, z2, m4);
        m4.decompose(head.position, head.quaternion, head.scale);
        headGlow.position.set(head.position.x, 0.015, head.position.z);
        headGlow.quaternion.copy(head.quaternion);
        headGlow.scale.set(len + 0.4, 1, 1);
      },
      alpha(a) { wallMat.opacity = 0.9 * a; glowMat.opacity = 0.55 * a; walls.visible = glows.visible = a > 0.01; if (a <= 0.01) head.visible = headGlow.visible = false; },
      flash(k) { wallMat.emissiveIntensity = 0.7 + k; },
    };
  }

  function wordTexture(text, fill, stroke) {
    const [c, g] = gfx.makeCanvas(512, 160);
    g.font = `64px ${gfx.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 16;
    g.strokeStyle = '#14121f';
    g.strokeText(text, 256, 84);
    g.fillStyle = stroke || '#ff4fa3';
    g.fillText(text, 256, 90);
    g.fillStyle = fill || '#ffffff';
    g.fillText(text, 256, 84);
    return gfx.toTexture(c);
  }
  // particles (from TT Penguin Push): a pool of sprites that fly, fall, spin and fade
  function makeParticles(scene, tex, max, blending) {
    const pool = [];
    for (let k = 0; k < max; k++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: blending || T.NormalBlending }));
      s.visible = false;
      scene.add(s);
      pool.push({ s, life: 0, t: 0, vx: 0, vy: 0, vz: 0, g: 0, s0: 1, s1: 1, spin: 0 });
    }
    let next = 0;
    return {
      emit(x, y, z, o = {}) {
        const p = pool[next];
        next = (next + 1) % max;
        p.s.visible = true;
        p.s.position.set(x, y, z);
        p.t = 0;
        p.life = o.life || 0.8;
        p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
        p.g = o.g != null ? o.g : 0;
        p.s0 = o.s0 != null ? o.s0 : 0.5;
        p.s1 = o.s1 != null ? o.s1 : 0.1;
        p.drag = o.drag || 0;
        p.s.material.color.set(o.color || '#ffffff');
        p.s.material.rotation = Math.random() * 6;
        p.spin = o.spin || 0;
        p.alpha = o.alpha != null ? o.alpha : 1;
        return p;
      },
      burst(x, y, z, n, o = {}) {
        for (let k = 0; k < n; k++) {
          const a = Math.random() * Math.PI * 2, sp = (o.speed || 3) * (0.4 + Math.random() * 0.8);
          this.emit(x, y, z, Object.assign({}, o, {
            vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: (o.up || 0) * (0.5 + Math.random() * 0.8),
            color: o.colors ? o.colors[k % o.colors.length] : o.color,
          }));
        }
      },
      update(dt) {
        for (const p of pool) {
          if (!p.s.visible) continue;
          p.t += dt;
          if (p.t >= p.life) { p.s.visible = false; continue; }
          const u = p.t / p.life;
          p.vy -= p.g * dt;
          const d = Math.exp(-p.drag * dt);
          p.vx *= d; p.vy *= d; p.vz *= d;
          p.s.position.x += p.vx * dt;
          p.s.position.y += p.vy * dt;
          p.s.position.z += p.vz * dt;
          if (p.s.position.y < 0.05 && p.g > 0) { p.s.position.y = 0.05; p.vy = Math.abs(p.vy) * 0.3; }
          p.s.scale.setScalar(p.s0 + (p.s1 - p.s0) * u);
          p.s.material.rotation += p.spin * dt;
          p.s.material.opacity = p.alpha * (u > 0.7 ? (1 - u) / 0.3 : 1);
        }
      },
      clear() { for (const p of pool) p.s.visible = false; },
    };
  }
  function squareTexture() {
    const [c, g] = gfx.makeCanvas(32, 32);
    g.fillStyle = '#fff';
    g.fillRect(4, 4, 24, 24);
    return gfx.toTexture(c);
  }
  function starTexture() {
    const [c, g] = gfx.makeCanvas(64, 64);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 12 : 30, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.fill();
    return gfx.toTexture(c);
  }
  // the companion's ZAP: a flat glowing ring that grows out from you
  function makeRing(scene) {
    const m = new T.Mesh(new T.RingGeometry(0.82, 1, 64), new T.MeshBasicMaterial({ color: '#3be8ff', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.06;
    m.visible = false;
    scene.add(m);
    return m;
  }
  // the bubble shield round a bike on EASY
  function makeBubble() {
    const m = new T.Mesh(new T.SphereGeometry(1.0, 20, 14), new T.MeshStandardMaterial({ color: '#bff6ff', emissive: '#3be8ff', emissiveIntensity: 0.25, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false }));
    m.renderOrder = 2;
    return m;
  }
  // the little glowing disc the companion floats on
  function makeHover(color) {
    const g = new T.Group();
    const top = new T.Mesh(new T.CylinderGeometry(0.6, 0.48, 0.14, 24), gfx.std('#ffffff', { roughness: 0.3 }));
    g.add(top);
    const rim = new T.Mesh(new T.TorusGeometry(0.56, 0.06, 8, 32), new T.MeshBasicMaterial({ color }));
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    return g;
  }
  // the winner's podium for the end of the cup
  function makePodium() {
    const g = new T.Group();
    const a = new T.Mesh(new T.CylinderGeometry(2.1, 2.3, 0.7, 32), gfx.std('#ffd400', { roughness: 0.35, emissive: '#ff9f1c', emissiveIntensity: 0.15 }));
    a.position.y = 0.35;
    a.castShadow = a.receiveShadow = true;
    g.add(a);
    const b = new T.Mesh(new T.TorusGeometry(2.2, 0.1, 8, 40), new T.MeshBasicMaterial({ color: '#3be8ff' }));
    b.rotation.x = Math.PI / 2;
    b.position.y = 0.7;
    g.add(b);
    g.visible = false;
    return g;
  }

  TR.Art = {
    RIM, makeWorld, makeArena, makeBike, makeTrail, wordTexture, makeParticles, squareTexture, starTexture,
    makeRing, makeBubble, makeHover, makePodium,
  };
})();
