/* 中文 for TT Trail Racer: the words on the page, the toasts and banners, the ? panel (Kit.lang, from kit/lang.js),
   and the comic words drawn on canvases (ZOOM!, BOING!, through Kit.lang.t in js/game.js). The riders' names stay in
   English; the logo shows 光轮赛车 (TR.ZH). */
(function () {
  const L = Kit.lang;
  const NAMES = ['TEDDY', 'TOMMY', 'FOXY', 'FROGGY'];
  L.keep([...NAMES, 'Teddy', 'Tommy', 'Foxy', 'Froggy', TR.TITLE, TR.TITLE.toUpperCase(), 'Claude Code', 'Esc', 'Space', 'Enter']);
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const NAME = `(${NAMES.join('|')})`;

  L.add({
    // title
    "Teddy & Tommy's glowing bike race": 'Teddy 和 Tommy 的光轮赛车大赛',
    '🏍️ 1 PLAYER': '🏍️ 单人', 'race Foxy and Froggy': '和 Foxy、Froggy 比赛',
    '👫 2 PLAYERS': '👫 双人', 'Teddy and Tommy together': 'Teddy 和 Tommy 一起玩',
    'PLAY AS': '选择', Hero: '英雄', Difficulty: '难度',
    'slow bikes, a bubble shield': '车慢一点，还有泡泡护盾', 'for big kids': '大孩子玩',
    'PLAYER 1': '玩家 1', 'PLAYER 2': '玩家 2', turn: '转弯', boost: '加速',
    "Tap the round pad the way you want to turn. Tap BOOST to zoom. Tap your brother's face to call him.":
      '点圆形方向键，往那边转弯。点“加速”冲一下。点兄弟的头像叫他来帮忙。',
    'built with': '制作：', 'LOADING…': '加载中…',
    // HUD, touch and buttons
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', BOOST: '加速',
    '▶ RESUME': '▶ 继续', MENU: '菜单', 'P · Esc to resume · Q for the menu · M sound': 'P · Esc 继续 · Q 回菜单 · M 声音',
    'PLAY AGAIN': '再玩一次', 'Enter to play again · Esc for the menu': '回车再玩一次 · Esc 回菜单',
    'TIE ROUND!': '平局！', 'GO!': '出发！',
    // toasts
    '🫧 BUBBLE SAVE!': '🫧 泡泡救了你！', '✋ HIGH FIVE! ✋': '✋ 击掌！✋',
    // results
    'GOOD TRY!': '再接再厉！', 'First to 5 rounds!': '最先赢 5 个回合！', 'Good race! Play again?': '比得真好！再玩一次？',
    'Out of lives. Try again!': '命用完了，再试一次！', SCORE: '得分', 'HI-SCORE': '最高分', ROUNDS: '回合', 'NEW!': '新纪录！',
    // canvas words
    'ZOOM!': '冲呀！', 'BOING!': '啵嘤！', 'BUBBLE POP!': '泡泡破啦！',
    // the ? panel
    'call your brother': '叫兄弟', 'pause · sound': '暂停 · 声音',
    "In 1 player both sets of keys work. Your bike turns the way the arrow points on the screen, but never straight back. Don't bump into a trail or the wall! The last rider riding wins the round; the first to win 5 rounds wins the cup. With two players, T is a high five.":
      '单人时两套按键都能用。光轮车会往屏幕上箭头指的方向转弯，但不能直接掉头。别撞到光墙或者围墙！最后还在骑的车手赢这一回合，最先赢 5 个回合的拿奖杯。两个人玩时，T 是击掌。',
  });
  L.rule(/^ROUND (\d+)$/, '第 $1 回合');
  L.rule(/^SCORE (\d+)$/, '得分 $1');
  L.rule(/^HI-SCORE (\d+)$/, '最高分 $1');
  L.rule(new RegExp(`^${NAME} WINS!$`), '$1 赢了！');
  L.rule(new RegExp(`^${NAME} WINS THE CUP!$`), '$1 拿到奖杯啦！');
  L.rule(new RegExp(`^${NAME} SCORE$`), '$1 得分');
  L.rule(new RegExp(`^(${NAME} \\d+( · )?)+$`), (m) => m); // "TEDDY 5 · FOXY 2": names and numbers only
  L.rule(new RegExp(`^BOING! ${NAME} IS OUT THIS ROUND$`), '啵嘤！$1 这一回合出局啦');
  L.rule(new RegExp(`^${NAME} IS HERE!$`), '$1 来啦！');
  L.rule(new RegExp(`^(\\S+) (${Object.keys(TREAT).join('|')}) FROM ${NAME}!$`), (m, e, t, who) => `${e} ${who} 送来的${TREAT[t]}！`);
  L.rule(new RegExp(`^${NAME} SAYS: ZAP! ALL CLEAR!$`), '$1 说：嗞啦！光墙全清光！');
  L.rule(new RegExp(`^${NAME} SAYS: YOU CAN DO IT!$`), '$1 说：你能行！');
})();
