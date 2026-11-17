// 地底人診断：回答 → 性格スコア → ★、性格タイプの判定

import { PARAM_KEYS } from "./params.js";
import { TYPES, TYPE_WEIGHTS } from "./types.js";

// 割合（0〜1）→ ★1〜5 の境目
export const STAR_THRESHOLDS = [
  { min: 0.55, stars: 5 },
  { min: 0.4, stars: 4 },
  { min: 0.25, stars: 3 },
  { min: 0.12, stars: 2 },
];

// 各パラメーターで取れる最大点（質問データから自動計算）
export function maxPointsByParam(questions) {
  const max = Object.fromEntries(PARAM_KEYS.map((key) => [key, 0]));
  questions.forEach((question) => {
    PARAM_KEYS.forEach((key) => {
      max[key] += Math.max(...question.options.map((option) => option.points[key] || 0));
    });
  });
  return max;
}

export function toStars(ratio) {
  const hit = STAR_THRESHOLDS.find((threshold) => ratio >= threshold.min);
  return hit ? hit.stars : 1;
}

// answers: 質問と同じ順番の、選んだ選択肢の番号（0〜3）の配列
export function scoreAnswers(questions, answers) {
  const max = maxPointsByParam(questions);
  const raw = Object.fromEntries(PARAM_KEYS.map((key) => [key, 0]));
  const likeSignals = new Set();

  questions.forEach((question, index) => {
    const option = question.options[answers[index]];
    if (!option) return;
    Object.entries(option.points).forEach(([key, value]) => {
      if (key in raw) raw[key] += value;
    });
    (option.likeCategories || []).forEach((category) => likeSignals.add(category));
  });

  const ratio = {};
  const stars = {};
  PARAM_KEYS.forEach((key) => {
    ratio[key] = max[key] > 0 ? raw[key] / max[key] : 0;
    stars[key] = toStars(ratio[key]);
  });

  return { raw, ratio, stars, likeSignals };
}

// 性格タイプの判定
export function determineType(ratio, types = TYPES) {
  const topParam = [...PARAM_KEYS].sort((a, b) => ratio[b] - ratio[a])[0];
  const scored = types.map((type, order) => ({
    type,
    order,
    score: ratio[type.main] * TYPE_WEIGHTS.main + ratio[type.sub] * TYPE_WEIGHTS.sub,
  }));
  scored.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 1e-9) return b.score - a.score;
    // 同点：回答者のいちばん高い項目を main に持つタイプを優先
    const aTop = a.type.main === topParam ? 1 : 0;
    const bTop = b.type.main === topParam ? 1 : 0;
    if (aTop !== bTop) return bTop - aTop;
    return a.order - b.order;
  });
  return scored[0].type;
}
