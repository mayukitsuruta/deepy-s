// 地底人診断：8つの性格パラメーター
// キーはこのファイルを正とし、質問・配点・キャラクター・相性計算すべてで同じものを使う。

export const PARAMS = [
  { key: "curiosity", label: "好奇心", desc: "新しいものや未知のことに興味を持つ力" },
  { key: "sociability", label: "社交性", desc: "人と関わったり、会話したりすることが好きな傾向" },
  { key: "action", label: "行動力", desc: "思いついたことを実際に行動に移す力" },
  { key: "creativity", label: "創造性", desc: "新しいアイデアや発想を生み出す力" },
  { key: "sensitivity", label: "感受性", desc: "周囲の変化や人の気持ちを感じ取る力" },
  { key: "inquiry", label: "探究心", desc: "一つのことを深く調べたり追求したりする傾向" },
  { key: "cooperation", label: "協調性", desc: "周囲と協力したり、相手に合わせたりする力" },
  { key: "caution", label: "慎重さ", desc: "先のことを考え、計画的に行動する傾向" },
];

export const PARAM_KEYS = PARAMS.map((param) => param.key);

// 好きなもののカテゴリ（相性計算の補助にだけ使う。画面には出さない）
export const LIKE_CATEGORIES = {
  kirakira: "きらきら・光るもの",
  oto: "音・音楽",
  shizuka: "静かな場所",
  shizen: "自然・生き物",
  hon: "本・文化",
  asobi: "体を動かす遊び",
  kawaii: "かわいい・おしゃれ",
  fushigi: "不思議・発見",
};
