// 地底人診断：ホームステイ予想（診断結果で1位になった地底人のものを表示）
//
// format: "experience" … 体験紹介形式 / "timeline" … 時間帯形式
// status: "final" … 確定 / "provisional" … 仮（ゲーム完成後に items を差し替えて "final" に）
// 画面に表示するのは items の label と text だけ。status・note・source は管理用メモ。

export const HOMESTAY_HEADINGS = {
  experience: "こんなホームステイが楽しめそう！",
  timeline: "こんな1日が過ごせそう！",
};

export const HOMESTAY = {
  chippy: {
    format: "experience",
    status: "final",
    items: [
      { label: "道づくりのお手伝い", text: "ホースで土を「すーっ」と吸い込む道づくりを、すぐそばで見られるよ！", source: "main.js ストーリー台詞" },
      { label: "キラキラさがし", text: "土にまぎれたクリスタルを探そう！花や果実が出てもめげないで！", source: "main.js ストーリー台詞・ゲーム" },
      { label: "ありがとうの一言", text: "見つけたら「ありがとう！」って喜んでくれるはず。", source: "main.js ゲームクリア時の台詞" },
      { label: "仕事終わりの休憩", text: "がんばったあとは、一緒にほっとひと休みしよう！", source: "好きなもの" },
    ],
  },
  simpy: {
    format: "experience",
    status: "final",
    items: [
      { label: "音さがし", text: "鈴の音や古い楽器、とっても静かな音まで。一緒に耳をすませよう！", source: "main.js ストーリー台詞／好きなもの" },
      { label: "メロディならべ", text: "ばらばらの小節を、聴いた順に並べて一曲を完成させよう♪", source: "main.js ストーリー台詞・メロディゲーム" },
      { label: "夜のうた", text: "集めた音を歌い返す夜の時間。あなたにも聴かせてくれるかも！", source: "main.js ストーリー台詞" },
    ],
  },
  nasupy: {
    format: "experience",
    status: "provisional",
    note: "ゲーム内容が未完成のため、公式設定とストーリー台詞をもとにした仮の紹介文",
    items: [
      { label: "植物の診療室", text: "深層の診療室で、虫めがねを使った診察を見学しよう！", source: "main.js ストーリー台詞" },
      { label: "植物の声", text: "声が小さい子は、具合が悪いサイン。一緒に耳をすませてみよう。", source: "main.js ストーリー台詞" },
      { label: "名前づけ", text: "診た植物には、ひとつずつ名前をつけるよ。今日はどんな名前かな？", source: "main.js ストーリー台詞" },
      { label: "辛いもの好き", text: "とても辛い料理が大好き！辛いのが苦手な人は、ちょっとドキドキかも？", source: "好きなもの" },
    ],
  },
  hitopy: {
    format: "experience",
    status: "provisional",
    note: "ゲーム内容が未完成のため、公式設定をもとにした仮の紹介文",
    items: [
      { label: "理想の家トーク", text: "素敵な家を建てるのが夢！あなたの意見もしっかり聞いてくれるよ。", source: "図鑑の公開情報／性格" },
      { label: "きっちり計画", text: "几帳面だから予定はばっちり。安心してついていけそう！", source: "性格" },
      { label: "みんなをつなぐ", text: "地底のみんなの暮らしをつなぐ建築家。一緒なら、新しい出会いがありそう！", source: "図鑑の公開情報" },
      { label: "海の話", text: "海や海の生き物の話で、盛り上がれるかも？", source: "好きなもの" },
    ],
  },
  deepy: {
    format: "timeline",
    status: "final",
    items: [
      { label: "朝", text: "地底にやってきたあなたをお出迎え！ルームシェアの仲介人として、地底の暮らしを案内してくれるよ。", source: "設定（職業・背景）" },
      { label: "昼", text: "上層・中層・深層をめぐる地底ツアーへ！マップをドラッグしてお散歩しよう。", source: "index.html 交流スペース" },
      { label: "夕方", text: "お気に入りの家を選んで、地層マップに置いてみよう。掲示板であいさつも！", source: "index.html 交流スペース" },
      { label: "夜", text: "今日の思い出を、フレームつき写真でパシャリ。地上の本や文化の話で盛り上がろう！", source: "index.html カメラ／好きなもの" },
    ],
  },
  zarpy: {
    format: "timeline",
    status: "final",
    items: [
      { label: "朝", text: "元気に話しかけてくれて、一日がスタート！すぐに仲良くなれちゃう。", source: "性格" },
      { label: "昼", text: "砂を使ったサーフィンに、一緒にチャレンジ！見ているだけでワクワク！", source: "背景／職業" },
      { label: "夕方", text: "楽しいアイデアを思いついたら、すぐ挑戦！どんな案も「いいね！」って受け止めてくれるよ。", source: "性格" },
      { label: "夜", text: "地上の海の話で盛り上がろう。地底に海を作る夢を語ってくれるかも！", source: "背景" },
    ],
  },
  stappy: {
    format: "timeline",
    status: "final",
    items: [
      { label: "朝", text: "会ってすぐ、あなたのいいところを見つけてほめてくれるよ！", source: "性格" },
      { label: "昼", text: "地底のみんなのアイテムを作る、こだわりの作品づくりをそばで見られるかも！", source: "背景／性格" },
      { label: "夕方", text: "あなたの魅力を引き出すアイテムを、一緒に考えてくれるかも？", source: "背景" },
      { label: "夜", text: "光るもの・かわいいものの話で、おしゃべりが止まらない夜に！", source: "好きなもの" },
    ],
  },
};
