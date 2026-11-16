// 地底人診断：質問・選択肢・配点
// ・どの選択肢も合計4点（10問すべて同じ重要度）
// ・points のキーは params.js の PARAM_KEYS と同じ
// ・likeCategories は好きなもの照合用（空配列なら照合に使わない）

export const QUESTIONS = [
  {
    id: "q1",
    text: "休日に自由な時間ができたら、どんな過ごし方をしたい？",
    options: [
      { id: "A", label: "行ったことのない場所へ出かけてみる", points: { curiosity: 2, action: 2 }, likeCategories: ["asobi"] },
      { id: "B", label: "友達や誰かと一緒に過ごす", points: { sociability: 3, cooperation: 1 }, likeCategories: [] },
      { id: "C", label: "好きなことにじっくり取り組む", points: { inquiry: 2, creativity: 2 }, likeCategories: [] },
      { id: "D", label: "家でゆっくり、自分のペースで過ごす", points: { sensitivity: 2, caution: 2 }, likeCategories: ["shizuka"] },
    ],
  },
  {
    id: "q2",
    text: "初めて参加するグループや集まりでは、どんな行動をする？",
    options: [
      { id: "A", label: "自分から積極的に話しかける", points: { sociability: 2, action: 2 }, likeCategories: [] },
      { id: "B", label: "周りの様子を見ながら、話せそうな人と交流する", points: { sociability: 2, caution: 1, cooperation: 1 }, likeCategories: [] },
      { id: "C", label: "誰かが話しかけてくれるのを待つ", points: { caution: 3, sensitivity: 1 }, likeCategories: [] },
      { id: "D", label: "全体の様子を見ながら、困っている人がいればサポートする", points: { cooperation: 2, sensitivity: 2 }, likeCategories: [] },
    ],
  },
  {
    id: "q3",
    text: "突然予定していなかった出来事が起きたら？",
    options: [
      { id: "A", label: "まずは行動して、解決方法を探す", points: { action: 3, curiosity: 1 }, likeCategories: [] },
      { id: "B", label: "状況を確認してから、できることを考える", points: { caution: 2, inquiry: 2 }, likeCategories: [] },
      { id: "C", label: "一度落ち着いて、慎重に対応する", points: { caution: 3, sensitivity: 1 }, likeCategories: [] },
      { id: "D", label: "周囲の人と相談しながら解決する", points: { cooperation: 3, sociability: 1 }, likeCategories: [] },
    ],
  },
  {
    id: "q4",
    text: "自由に何かを作ってよいと言われたら？",
    options: [
      { id: "A", label: "今までにない新しいものを考える", points: { creativity: 3, curiosity: 1 }, likeCategories: [] },
      { id: "B", label: "自分の好きな世界観やデザインを表現する", points: { creativity: 2, sensitivity: 2 }, likeCategories: [] },
      { id: "C", label: "情報を集めて、じっくり考えてから作る", points: { inquiry: 2, caution: 2 }, likeCategories: [] },
      { id: "D", label: "誰かに喜んでもらえるものを作る", points: { cooperation: 2, sensitivity: 1, creativity: 1 }, likeCategories: [] },
    ],
  },
  {
    id: "q5",
    text: "友達がいつもより元気がないことに気づいたら？",
    options: [
      { id: "A", label: "すぐに声をかけて話を聞く", points: { sociability: 2, action: 2 }, likeCategories: [] },
      { id: "B", label: "相手の様子を見ながら、そっと寄り添う", points: { sensitivity: 3, cooperation: 1 }, likeCategories: [] },
      { id: "C", label: "気分転換になるような楽しいことを提案する", points: { sociability: 2, creativity: 1, action: 1 }, likeCategories: [] },
      { id: "D", label: "相手が話したくなるまで、無理に聞かず見守る", points: { sensitivity: 2, caution: 2 }, likeCategories: [] },
    ],
  },
  {
    id: "q6",
    text: "知らないことや気になることを見つけたら？",
    options: [
      { id: "A", label: "すぐに調べて、いろいろなことを知りたくなる", points: { curiosity: 3, inquiry: 1 }, likeCategories: ["hon"] },
      { id: "B", label: "実際に体験して、自分で確かめたい", points: { action: 2, inquiry: 2 }, likeCategories: ["asobi"] },
      { id: "C", label: "一つのことを深く掘り下げて理解したい", points: { inquiry: 3, caution: 1 }, likeCategories: [] },
      { id: "D", label: "面白そうだと思ったら、まずは気軽に触れてみる", points: { curiosity: 3, action: 1 }, likeCategories: [] },
    ],
  },
  {
    id: "q7",
    text: "旅行やお出かけの計画を立てるなら？",
    options: [
      { id: "A", label: "行きたい場所を決めて、細かく計画する", points: { caution: 3, inquiry: 1 }, likeCategories: [] },
      { id: "B", label: "大まかな予定だけ決めて、あとは現地で考える", points: { curiosity: 2, caution: 1, action: 1 }, likeCategories: [] },
      { id: "C", label: "その日の気分に合わせて自由に行動する", points: { action: 2, creativity: 1, curiosity: 1 }, likeCategories: [] },
      { id: "D", label: "一緒に行く人の希望を聞いて、みんなで決める", points: { cooperation: 3, sociability: 1 }, likeCategories: [] },
    ],
  },
  {
    id: "q8",
    text: "誰かと意見が違ったとき、どうする？",
    options: [
      { id: "A", label: "自分の考えをしっかり伝える", points: { action: 2, inquiry: 1, sociability: 1 }, likeCategories: [] },
      { id: "B", label: "相手の考えを聞いて、お互いの意見を理解する", points: { sensitivity: 2, cooperation: 2 }, likeCategories: [] },
      { id: "C", label: "できるだけ全員が納得できる方法を探す", points: { cooperation: 3, creativity: 1 }, likeCategories: [] },
      { id: "D", label: "相手の意見を尊重し、状況に合わせる", points: { cooperation: 3, caution: 1 }, likeCategories: [] },
    ],
  },
  {
    id: "q9",
    text: "日常生活で、つい気になってしまうことは？",
    options: [
      { id: "A", label: "景色や色、音など、何気ない周囲の変化", points: { sensitivity: 3, curiosity: 1 }, likeCategories: ["oto", "shizen"] },
      { id: "B", label: "かわいいものや美しいもの、デザイン", points: { creativity: 3, sensitivity: 1 }, likeCategories: ["kirakira", "kawaii"] },
      { id: "C", label: "人の表情や言葉に隠れた気持ち", points: { sensitivity: 3, sociability: 1 }, likeCategories: [] },
      { id: "D", label: "普段は気づかないような不思議なことや小さな発見", points: { curiosity: 2, inquiry: 2 }, likeCategories: ["fushigi"] },
    ],
  },
  {
    id: "q10",
    text: "新しいことに挑戦するとき、自分に近いのは？",
    options: [
      { id: "A", label: "面白そうなら、まず挑戦してみる", points: { action: 3, curiosity: 1 }, likeCategories: [] },
      { id: "B", label: "成功する方法を考えてから挑戦する", points: { caution: 3, inquiry: 1 }, likeCategories: [] },
      { id: "C", label: "失敗しても学びになると思って挑戦する", points: { action: 2, inquiry: 2 }, likeCategories: [] },
      { id: "D", label: "自分だけでなく、周囲の人とも相談して決める", points: { cooperation: 3, sociability: 1 }, likeCategories: [] },
    ],
  },
];
