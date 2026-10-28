/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
// the kit's usual spot (50% - 20px) on a sideways screen; on a tall one (the last term goes negative when wide), lower
const KIT_TOP = 'max(calc(50% - 20px), min(calc(80vw + 90px), calc(100% - 200px), calc(50% - 20px + (100vh - 100vw) * 10)))';
Kit.help.setup({
  title: TR.TITLE,
  cols: ['Player 1', 'Player 2'],
  keys: [
    ['turn', 'W A S D', '↑ ← ↓ →'],
    ['boost', 'Space', 'Enter'],
    ['call your brother', 'T', ''],
    ['pause · sound', 'P or Esc · M', ''],
  ],
  note: 'In 1 player both sets of keys work. Your bike turns the way the arrow points on the screen, but never straight back. Don\'t bump into a trail or the wall! The last rider riding wins the round; the first to win 5 rounds wins the cup. With two players, T is a high five.',
  touch: "Tap the round pad the way you want to turn. Tap BOOST to zoom. Tap your brother's face to call him.",
  // the middle of the left edge on a sideways screen; on a tall screen, just under the arena (which fills the width)
  button: { top: KIT_TOP, left: 'max(10px, env(safe-area-inset-left))' },
});
Kit.lang.setup({ button: { top: `calc(${KIT_TOP} + 48px)`, left: 'max(10px, env(safe-area-inset-left))' } });
