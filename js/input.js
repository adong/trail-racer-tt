/* Keys to racing: which rider a key steers and which way, read from real keydown events (js/game.js passes them in).
   A turn is a single press: the rules (js/sim.js) keep it until the bike reaches the middle of its next cell.
   - 1 player: W A S D and the arrows both steer, Space and Enter both boost.
   - 2 players: Teddy has W A S D and Space, Tommy has the arrows and Enter.
   - Holding a key never repeats it, and leaving the window (blur) lets go of everything, so no key can get stuck down.
   Directions: 0 up, 1 right, 2 down, 3 left, as they look on the screen (the camera never turns or mirrors). */
(function () {
  'use strict';
  const DIR1 = { KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
  const DIR2 = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
  const BOOST1 = { Space: 1 }, BOOST2 = { Enter: 1, NumpadEnter: 1 };
  const I = {
    two: false,
    mirror: false, // only for the play check's "must fail" run: swaps left and right
    held: new Set(),
    isGameKey: (code) => code in DIR1 || code in DIR2 || code in BOOST1 || code in BOOST2,
    // a key went down: { who, dir } or { who, boost: true }, or null if it isn't a racing key (or is still held)
    down(code) {
      if (!this.isGameKey(code)) return null;
      if (this.held.has(code)) return null;
      this.held.add(code);
      const who = code in DIR1 || code in BOOST1 ? 0 : this.two ? 1 : 0;
      if (code in BOOST1 || code in BOOST2) return { who, boost: true };
      let dir = code in DIR1 ? DIR1[code] : DIR2[code];
      if (this.mirror && (dir === 1 || dir === 3)) dir = 4 - dir;
      return { who, dir };
    },
    up(code) { this.held.delete(code); },
    clear() { this.held.clear(); },
    // the round touch pad: which way a finger points from its middle (-1 in the dead middle)
    padDir(dx, dy, r) {
      if (Math.hypot(dx, dy) < r * 0.14) return -1;
      let d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      if (this.mirror && (d === 1 || d === 3)) d = 4 - d;
      return d;
    },
  };
  TR.Input = I;
})();
