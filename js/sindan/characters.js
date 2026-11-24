// 地底人診断：キャラクターデータ（7匹）
//
// 結果画面が読むのは name・image・profile だけ。
// internal は相性計算と内部管理専用で、画面には表示しない（秘密情報は internal.secret）。
// 値が null の項目は画面に表示しない。後から値を入れれば、そのまま表示される。
// image は元データ（images フォルダ）のファイル名をそのまま使う。未設定は null。

export const CHARACTERS = [
  {
    id: "chippy",
    name: "CHIPPY",
    image: "./images/green.png",
    profile: {
      occupation: "土吸収員",
      likes: ["きれいに整った土", "土の収集", "仕事終わりの休憩"],
      personality: [
        "少しストイックで責任感が強い。",
        "仕事には妥協せず、目標を決めたら最後までやり抜くタイプ。",
        "普段は落ち着いているが、土のことになるとつい熱くなってしまう一面もある。",
      ],
      background: [
        "地底で土を吸収し、集めた土を管理する「土吸収員」として働いている。",
        "地底の環境を維持するため、毎日決められた量の土を吸収し、必要な場所へ運んでいる。",
        "仕事に対してとても真面目で、吸収する土の量や質にもこだわりを持っている。",
        "どんなに大変な作業でも最後までやり遂げる努力家。",
      ],
      foundAt: "上層の道ぞい",
      imageColors: ["黄緑"],
      motifs: null,
      accessories: ["土を吸い込む専用ホース", "背負い式の吸引タンク"],
    },
    internal: {
      params: { curiosity: 2, sociability: 2, action: 4, creativity: 2,
                sensitivity: 3, inquiry: 4, cooperation: 3, caution: 4 },
      likeCategories: ["shizen"], // 土（2つ）→ 自然・生き物。「仕事終わりの休憩」は相性計算に使わない
      lifestyle: null,
      secret: { personality: null, features: null },
    },
  },
  {
    id: "simpy",
    name: "SIMPY",
    image: "./images/pink.png",
    profile: {
      occupation: "音の採集家",
      likes: ["不思議な音", "鈴", "音楽", "静かな場所", "古い楽器"],
      personality: [
        "普段は静かで控えめ。",
        "音楽や好きな音の話になると、急におしゃべりになる。",
        "自分の好きなことに夢中になる。",
        "小さな音や静かな音にも興味を持つ。",
      ],
      background: null,
      foundAt: "音の多い中層",
      imageColors: null,
      motifs: null,
      accessories: null,
    },
    internal: {
      params: { curiosity: 4, sociability: 2, action: 2, creativity: 4,
                sensitivity: 5, inquiry: 5, cooperation: 3, caution: 4 },
      likeCategories: ["oto", "shizuka"],
      lifestyle: null,
      secret: {
        personality: null,
        features: [
          "地底に響くさまざまな音を集めている。",
          "音を集める専用の装置を持っている。",
          "夜になると、集めた音を一人で歌にしている。",
        ],
      },
    },
  },
  {
    id: "nasupy",
    name: "NASUPY",
    image: "./images/purple.png",
    profile: {
      occupation: "植物の医者",
      likes: ["植物", "とても辛い料理"],
      personality: [
        "穏やかで落ち着いている。",
        "優しく、相手の話をじっくり聞く。",
        "相手の気持ちに寄り添うことが得意。",
        "小さな変化にもよく気づく。",
      ],
      background: null,
      foundAt: "深層の植え込み",
      imageColors: null,
      motifs: null,
      accessories: null,
    },
    internal: {
      params: { curiosity: 4, sociability: 3, action: 3, creativity: 3,
                sensitivity: 5, inquiry: 5, cooperation: 5, caution: 4 },
      likeCategories: ["shizen"], // 「とても辛い料理」は相性計算に使わない
      lifestyle: null,
      secret: {
        personality: null,
        features: [
          "地底の植物を診察し、元気に育つように世話をしている。",
          "植物と会話することができる。",
          "虫眼鏡を持っている。",
          "診察した植物には一つひとつ名前をつけている。",
          "植物の声の静かさから、その植物の状態を判断できる。",
        ],
      },
    },
  },
  {
    id: "hitopy",
    name: "HITOPY",
    image: "./images/white.png", // 診断では通常表示（シルエットにしない）
    profile: {
      occupation: "建築家",
      likes: ["海", "海の生き物"],
      personality: [
        "真面目で几帳面。",
        "理想を実現するために努力を積み重ねる。",
        "物事をしっかり考えてから行動する。",
        "周囲の意見を聞きながら、よりよい方法を考える。",
      ],
      background: null,
      foundAt: null,
      imageColors: null,
      motifs: null,
      accessories: null,
    },
    internal: {
      params: { curiosity: 4, sociability: 3, action: 3, creativity: 5,
                sensitivity: 3, inquiry: 4, cooperation: 4, caution: 5 },
      likeCategories: ["shizen"],
      lifestyle: null,
      secret: {
        personality: null,
        features: [
          "地底に素敵な家を建てることを夢見ている。",
          "地底人同士の暮らしをつなぐ建築家。",
          "ポケットには建築道具が入っている。",
          "完成した家よりも、まだ建っていない家について話すことが好き。",
        ],
      },
    },
  },
  {
    id: "deepy",
    name: "DEEPY",
    image: "./images/deepy.png",
    profile: {
      occupation: "地上研究員、仲介人",
      likes: ["地上に関する本、文化"],
      personality: [
        "好奇心旺盛で友好的。",
        "友人が多く、人と話すことがすき。",
        "おおらかな性格。",
      ],
      background: [
        "人間の世界、文化、言語など地上の研究を行っている。",
        "地底で語り継がれている地上世界の文献に興味を持ち、幼いころから地上について勉強を行っている。",
        "生活している地域が日本の直下のため、日本の本を発掘し日本語の言語を習得した。",
        "エジプトにてピラミッドを押し上げていることを日本の調査員に発見されて、人間と関わりを持ち始めるようになった。",
        "現在では、地上人の地底ルームシェア企画の仲介人をしながら、地上の研究を行っている。",
        "仕事以外では、同じ趣味の仲間や、友人と過ごしたり何かと知人の手伝いなどをしている。",
      ],
      foundAt: "地底にやってきた日",
      imageColors: ["オレンジ"],
      motifs: null,
      accessories: ["襟", "ネクタイ"],
    },
    internal: {
      params: { curiosity: 5, sociability: 5, action: 4, creativity: 4,
                sensitivity: 4, inquiry: 5, cooperation: 5, caution: 3 },
      likeCategories: ["hon"],
      lifestyle: null,
      secret: { personality: null, features: null },
    },
  },
  {
    id: "zarpy",
    name: "ZARPY",
    image: "./images/zarppy.png",
    profile: {
      occupation: "ザーファー（砂でサーフィンをするサーファー）",
      likes: ["化石", "ザーフボード"],
      personality: [
        "自分の「楽しそう！」と思ったことに熱中するタイプ。",
        "あくまで原動力は自分の好奇心。",
        "人懐っこく、人と話すことでエネルギーを得られる。",
        "肯定的で、まず自分から話しかける。",
      ],
      background: [
        "DEEPYの友達。",
        "DEEPYから教えてもらった地上の海を、いつか地底にも作るのが夢。",
        "小さいころから地上の話をDEEPYから聞いていて、地底の世界をもっと楽しくしたいと考えていた。",
        "そこで、海という地上の7割を占めるものがあると知り、同じように地底に海を作って新しいアクティビティを考えた末、地底で再現可能な砂のサーフィンを今は職業にしている。",
      ],
      foundAt: null,
      imageColors: ["黄色"],
      motifs: ["波", "砂の流れ", "海"],
      accessories: ["木の根から作られたザーフボード", "化石のネックレス"],
    },
    internal: {
      params: { curiosity: 5, sociability: 5, action: 5, creativity: 4,
                sensitivity: 3, inquiry: 4, cooperation: 4, caution: 2 },
      likeCategories: ["fushigi", "asobi"],
      lifestyle: null,
      secret: { personality: null, features: null },
    },
  },
  {
    id: "stappy",
    name: "STAPPY",
    image: "./images/stappy.png",
    profile: {
      occupation: "カリスマ（ファッションデザイナー、インフルエンサー）",
      likes: ["光るもの", "かわいいもの"],
      personality: [
        "ギャルマインド。",
        "基本的に明るくポジティブだが、こだわりは強め。",
        "人の良いところを見つけて褒める、陽のギャル。",
      ],
      background: [
        "地底のインフルエンサー兼デザイナー。",
        "地底人の身に着けているアイテムはすべてSTAPPYが制作している。",
        "自分の作ったものをデコるのが好きで、趣味で始めたところ、人に頼まれて作るようになった。",
        "そのため、地底ではインフルエンサー、流行の発信者として扱われている。",
        "DEEPYたちのチャームポイントとなる服を制作し、流行のアイテムを生み出している。",
      ],
      foundAt: null,
      imageColors: ["黄色", "水色"],
      motifs: ["星", "華やかさ"],
      accessories: ["ハイビスカス", "光る鉱石のブレスレット"],
    },
    internal: {
      params: { curiosity: 4, sociability: 5, action: 4, creativity: 5,
                sensitivity: 4, inquiry: 3, cooperation: 4, caution: 3 },
      likeCategories: ["kirakira", "kawaii"],
      lifestyle: null,
      secret: { personality: null, features: null },
    },
  },
];
