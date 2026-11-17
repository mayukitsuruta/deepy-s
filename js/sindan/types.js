// 地底人診断：性格タイプ（7種類）
// main・sub は params.js のキー。タイプの点数 = main の割合 × 0.6 + sub の割合 × 0.4

export const TYPE_WEIGHTS = { main: 0.6, sub: 0.4 };

export const TYPES = [
  {
    id: "challenger",
    name: "冒険好きなチャレンジャー",
    main: "curiosity",
    sub: "action",
    catch: "気になったら、まず動いてみる！新しい世界にワクワクできるタイプ。",
    traits: ["新しいことに興味しんしん", "思い立ったらすぐ行動", "はじめての場所もへっちゃら"],
    phrase: "好奇心旺盛で、行動力のある",
  },
  {
    id: "popular",
    name: "みんなの人気者",
    main: "sociability",
    sub: "cooperation",
    catch: "まわりの人と一緒に楽しめる、場を明るくするタイプ。",
    traits: ["人と話すのが好き", "みんなで楽しむのが得意", "自然と輪の中心に"],
    phrase: "人と関わるのが好きで、みんなを大切にする",
  },
  {
    id: "explorer",
    name: "こだわりの探究者",
    main: "inquiry",
    sub: "caution",
    catch: "気になることはとことん深く。じっくり向き合える研究家タイプ。",
    traits: ["ひとつのことを深掘りできる", "よく調べてから考える", "集中力がある"],
    phrase: "ひとつのことをじっくり深められる",
  },
  {
    id: "idea",
    name: "アイデアメーカー",
    main: "creativity",
    sub: "curiosity",
    catch: "「こうしたら面白いかも！」が次々浮かぶ、ひらめきタイプ。",
    traits: ["発想がゆたか", "新しいものが好き", "遊び心がある"],
    phrase: "ひらめきゆたかで、新しいものが好きな",
  },
  {
    id: "supporter",
    name: "心優しいサポーター",
    main: "sensitivity",
    sub: "cooperation",
    catch: "人の気持ちに気づいて、そっと寄り添えるやさしいタイプ。",
    traits: ["小さな変化に気づける", "相手の気持ちを大切にする", "みんなを支えられる"],
    phrase: "人の気持ちに気づけて、やさしく寄り添える",
  },
  {
    id: "creator",
    name: "マイペースなクリエイター",
    main: "creativity",
    sub: "sensitivity",
    catch: "自分の「好き」や感じたことを、カタチにできるタイプ。",
    traits: ["自分の世界観を持っている", "感じる力がゆたか", "自分のペースを大切にする"],
    phrase: "感性ゆたかで、自分の世界を持っている",
  },
  {
    id: "planner",
    name: "しっかり者の計画家",
    main: "caution",
    sub: "inquiry",
    catch: "先のことを考えて、しっかり準備できる頼れるタイプ。",
    traits: ["計画を立てるのが得意", "落ち着いて行動できる", "準備がばっちり"],
    phrase: "先を見通して、しっかり準備できる",
  },
];
