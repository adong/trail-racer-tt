/* Numbers that tune the game. Speeds are in cells per second, times in seconds.
   🐣 EASY is for Tommy (5): slower bikes, a bigger arena, a bubble shield for each brother's first bump of a round,
   5 lives, and Foxy and Froggy daydream now and then. 🔥 NORMAL is for Teddy (8). */
TR.TUNE = {
  HZ: 240, // the rules move in fixed ticks of 1/240 s, so the same keys give the same race at any frame rate
  winRounds: 5, // the first rider to win this many rounds wins the cup
  readyT: 2.4, // 3, 2, 1, GO!
  roundEndT: 2.8, // the round winner's little celebration before the next round
  fadeT: 1.0, // a bumped rider's trail sparkles away after this long
  boost: { mult: 1.75, time: 1.1, cool: 4 },
  ffwd: 4, // with no brother left riding, Foxy and Froggy finish the round this many times faster
  // the companion: pops in (the race goes slow-motion), signature move, treat, then ZAP: trails near you are gone
  buddy: { treat: 1.2, zap: 1.7, bye: 2.8, slow: 8, again: 0.5 },
  points: { cell: 1, outlast: 100, round: 500 },
  easy: { W: 40, H: 28, speed: 4.5, lives: 5, shield: true, radius: 7, cpu: { look: 6, blunder: 0.07, wander: 0.05, dodge: false } },
  normal: { W: 34, H: 24, speed: 7, lives: 3, shield: false, radius: 6, cpu: { look: 12, blunder: 0, wander: 0.03, dodge: true } },
};
