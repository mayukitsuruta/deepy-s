// 地底人診断：相性の計算とランキング
//
// 相性 = 性格の一致度 × 80% + 好きなもの × 10% + 生活スタイル × 10%
// ・データが無い項目（null）は外し、残りの重みを合計100%に直して計算する
// ・生活スタイルは今は未設定（全員 null）なので、性格 約89%：好きなもの 約11% になる
// ・表示％ = DISPLAY.base + DISPLAY.range × 相性（極端に低い数字が出にくいように）

import { PARAM_KEYS } from "./params.js";

export const WEIGHTS = { personality: 0.8, likes: 0.1, lifestyle: 0.1 };
export const DISPLAY = { base: 40, range: 60 };

// 性格の一致度：8項目の「形」が似ているほど高い（相関係数 r を 0〜1 に直す。正反対は 0）
export function personalitySimilarity(userRatio, characterParams) {
  const user = PARAM_KEYS.map((key) => userRatio[key]);
  const chara = PARAM_KEYS.map((key) => (characterParams[key] - 1) / 4);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const mu = mean(user);
  const mc = mean(chara);
  let num = 0;
  let du = 0;
  let dc = 0;
  for (let i = 0; i < PARAM_KEYS.length; i += 1) {
    num += (user[i] - mu) * (chara[i] - mc);
    du += (user[i] - mu) ** 2;
    dc += (chara[i] - mc) ** 2;
  }
  if (du === 0 || dc === 0) return 0.5;
  const r = num / Math.sqrt(du * dc);
  return (r + 1) / 2;
}

// ランダムに答えたとき、そのカテゴリのどれかに一致する確率（質問データから自動計算）
export function likeHitProbability(questions, categories) {
  let none = 1;
  questions.forEach((question) => {
    const hits = question.options.filter((option) =>
      (option.likeCategories || []).some((category) => categories.includes(category)),
    ).length;
    none *= 1 - hits / question.options.length;
  });
  return 1 - none;
}

// 好きなもの：一致しやすいキャラが有利にならないよう、一致しやすさを差し引いて 0〜1 にする
export function likesScore(likeSignals, categories, hitProbability) {
  if (!categories || categories.length === 0) return null;
  const hit = categories.some((category) => likeSignals.has(category)) ? 1 : 0;
  return 0.5 + 0.5 * (hit - hitProbability);
}

// 生活スタイル：設定が追加されたらここで比較する。今は全員 null なので計算に使わない
export function lifestyleScore(userLifestyle, characterLifestyle) {
  if (!userLifestyle || !characterLifestyle) return null;
  return null;
}

export function rankCharacters(questions, characters, scores) {
  const results = characters.map((character, order) => {
    const { params, likeCategories, lifestyle } = character.internal;
    const parts = {
      personality: personalitySimilarity(scores.ratio, params),
      likes: likesScore(
        scores.likeSignals,
        likeCategories,
        likeHitProbability(questions, likeCategories || []),
      ),
      lifestyle: lifestyleScore(null, lifestyle),
    };
    let weightSum = 0;
    let total = 0;
    Object.entries(parts).forEach(([key, value]) => {
      if (value === null) return;
      weightSum += WEIGHTS[key];
      total += WEIGHTS[key] * value;
    });
    const score = weightSum > 0 ? total / weightSum : 0;
    const percent = Math.min(100, Math.max(0, Math.round(DISPLAY.base + DISPLAY.range * score)));
    return { id: character.id, character, score, percent, parts, order };
  });

  results.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 1e-9) return b.score - a.score;
    // 同率：好きなもの → 生活スタイル → データの並び順
    const likeDiff = (b.parts.likes ?? -1) - (a.parts.likes ?? -1);
    if (likeDiff !== 0) return likeDiff;
    const lifeDiff = (b.parts.lifestyle ?? -1) - (a.parts.lifestyle ?? -1);
    if (lifeDiff !== 0) return lifeDiff;
    return a.order - b.order;
  });

  return results.map((result, index) => ({ ...result, rank: index + 1 }));
}
