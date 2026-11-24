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
      likes: ["きれいな鉱石、特にクリスタル"],
      personality: [
        "口数は少なく、静かで落ち着いている。",
        "困っている人を放っておけない、面倒見のよい性格。",
        "言葉よりも行動で優しさを示す。",
        "仕事には真面目に取り組む。",
      ],
      background: null,
      foundAt: "上層の道ぞい",
      imageColors: null,
      motifs: null,
      accessories: null,
    },
    internal: {
      params: { curiosity: 3, sociability: 2, action: 5, creativity: 2,
                sensitivity: 4, inquiry: 3, cooperation: 5, caution: 2 },
      likeCategories: ["kirakira"],
      lifestyle: null,
      secret: {
        personality: ["道づくりの途中でも、落とし物を見つけると探すことに夢中になる。"],
        features: [
          "地底で家を建てるために土を吸収して道を整備する。",
          "土を吸い込むホースを持っている。",
          "道づくりの途中で見つけたクリスタルが、実は誰かの落とし物だったという秘密がある。",
        ],
      },
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
      occupation: "地底の案内人",
      likes: ["地上の本や文化"],
      personality: [
        "明るく社交的。",
        "誰とでも仲良くなれる。",
        "人との会話や出会いが好き。",
        "新しい場所や文化に興味を持つ。",
        "初対面の人とも自然に打ち解けられる。",
      ],
      background: null,
      foundAt: "地底にやってきた日",
      imageColors: null,
      motifs: null,
      accessories: null,
    },
    internal: {
      params: { curiosity: 5, sociability: 5, action: 4, creativity: 4,
                sensitivity: 4, inquiry: 5, cooperation: 5, caution: 3 },
      likeCategories: ["hon"],
      lifestyle: null,
      secret: {
        personality: null,
        features: [
          "地上から来た人に地底での暮らしを案内する。",
          "青いガイドブックをいつも持ち歩いている。",
          "案内中に自分も知らなかった道を発見することがある。",
          "ガイドブックの最後には、まだ白紙のページが残っている。",
        ],
      },
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
        "「楽しそう！」と思ったことに熱中する。",
        "原動力は自分の好奇心。",
        "人懐っこく、人と話すことでエネルギーがもらえる。",
        "肯定的で、まず自分から話しかける。",
      ],
      background: [
        "DEEPYの友達。",
        "小さいころから地上の話をDEEPYに聞いていて、地底の世界をもっと楽しくしたいと考えていた。",
        "DEEPYから教えてもらった地上の海を、いつか地底にも作るのが夢。",
        "海が地上の7割を占めると知り、地底に海を作って新しいアクティビティを考えた。",
        "その末、今は地底で再現できる砂のサーフィンを仕事にしている。",
      ],
      foundAt: null,
      imageColors: ["水色", "青", "エメラルドグリーン"],
      motifs: ["波", "砂の流れ", "海"],
      accessories: ["化石のネックレス", "木の根を使ったザーフボード"],
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
        "ギャルマインド。基本的に明るくポジティブ。",
        "こだわりは強め。",
        "人の良いところを見つけて褒める、陽のギャル。",
      ],
      background: [
        "地底のインフルエンサー兼デザイナー。",
        "地底人が身に着けているアイテムは、すべてスタッピーが作っている。",
        "自分の作ったものをデコるのが好きで、趣味で始めたところ、人に頼まれて作るようになった。",
        "地底では流行の発信者として扱われている。",
        "DEEPYたちのチャームポイントになる服を作り、流行のアイテムを生み出している。",
      ],
      foundAt: null,
      imageColors: ["黄色", "ピンク"],
      motifs: ["ハート", "華やかさ"],
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
