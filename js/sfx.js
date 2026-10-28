/* TT Trail Racer's own synth sounds, made with Kit.sound.tone and Kit.sound.hiss (no audio files). They are silent
   until the first tap or key (Kit.sound.init) and follow the one sound switch (M, the 🔊 button, the kit's speaker). */
(function () {
  'use strict';
  const S = () => Kit.sound;
  let lastTurn = 0;
  const now = () => performance.now() / 1000;
  TR.Sfx = {
    count: 0, // every effect played, for the tests (they check sound in code, never by ear)
    played(name) { this.count++; this.last = name; },
    turn() {
      if (now() - lastTurn < 0.08) return;
      lastTurn = now();
      this.played('turn');
      S().tone({ f: 620, to: 760, type: 'triangle', dur: 0.05, vol: 0.04 });
    },
    beep(go) {
      this.played('beep');
      S().tone({ f: go ? 1046 : 523, type: 'square', lp: 2400, dur: go ? 0.32 : 0.14, vol: 0.08 });
      if (go) S().tone({ f: 1318, type: 'triangle', dur: 0.3, vol: 0.05, at: 0.05 });
    },
    boost() {
      this.played('boost');
      S().tone({ f: 220, to: 880, type: 'sawtooth', lp: 1800, dur: 0.35, vol: 0.07 });
      S().hiss({ f: 1200, to: 5000, filter: 'bandpass', q: 1, dur: 0.4, vol: 0.12 });
    },
    // a bump: a soft cartoon BOING, never a crash
    boing() {
      this.played('boing');
      S().tone({ f: 330, to: 140, type: 'sine', dur: 0.42, vol: 0.2 });
      S().tone({ f: 520, to: 260, type: 'triangle', dur: 0.3, vol: 0.06, at: 0.04 });
      [1318, 1568, 2093].forEach((f, k) => S().tone({ f, type: 'sine', dur: 0.12, vol: 0.035, at: 0.18 + k * 0.07 }));
    },
    pop() {
      this.played('pop');
      S().tone({ f: 900, to: 1500, type: 'sine', dur: 0.09, vol: 0.12 });
      S().hiss({ f: 4000, to: 2000, filter: 'highpass', dur: 0.08, vol: 0.1 });
    },
    fade() { this.played('fade'); [1568, 2093, 2637].forEach((f, k) => S().tone({ f, type: 'sine', dur: 0.1, vol: 0.025, at: k * 0.06 })); },
    zap() {
      this.played('zap');
      S().tone({ f: 300, to: 2400, type: 'square', lp: 3000, dur: 0.3, vol: 0.06 });
      [784, 988, 1175, 1568, 1976].forEach((f, k) => S().tone({ f, type: 'triangle', dur: 0.12, vol: 0.06, at: 0.08 + k * 0.05 }));
      S().hiss({ f: 6000, to: 1500, filter: 'highpass', dur: 0.5, vol: 0.08 });
    },
    hello() { this.played('hello'); [659, 784, 1046].forEach((f, k) => S().tone({ f, type: 'triangle', dur: 0.12, vol: 0.07, at: k * 0.08 })); },
    treat() { this.played('treat'); S().tone({ f: 500, to: 1000, type: 'sine', dur: 0.15, vol: 0.1 }); },
    five() {
      this.played('five');
      S().hiss({ f: 2600, to: 1800, filter: 'bandpass', q: 0.8, dur: 0.1, vol: 0.3 });
      S().tone({ f: 880, type: 'triangle', dur: 0.1, vol: 0.06, at: 0.05 });
    },
    round(win) {
      this.played('round');
      const notes = win ? [523, 659, 784, 1046] : [523, 494, 523];
      notes.forEach((f, k) => S().tone({ f, type: 'triangle', dur: 0.16, vol: 0.09, at: k * 0.11 }));
    },
    cup() {
      this.played('cup');
      [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, k) => S().tone({ f, type: k % 2 ? 'triangle' : 'square', lp: 3000, dur: 0.2, vol: 0.08, at: k * 0.12 }));
    },
    click() { this.played('click'); S().click && S().click(); },
  };
})();
