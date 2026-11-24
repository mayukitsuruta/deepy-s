// 地底人診断：画面の表示と操作（スタート → 質問10問 → 結果 → もう一度）
//
// 結果画面が読むキャラ情報は name・image・profile だけ（internal は表示しない）。
// ホームステイ予想は label・text だけを表示する。

import { PARAMS } from "./params.js";
import { QUESTIONS } from "./questions.js";
import { CHARACTERS } from "./characters.js";
import { HOMESTAY, HOMESTAY_HEADINGS } from "./homestay.js";
import { scoreAnswers, determineType } from "./scoring.js";
import { rankCharacters } from "./compatibility.js";

// 結果画面に出すプロフィール項目（この順番で表示。null や空の項目は出さない）
const PROFILE_FIELDS = [
  { key: "occupation", label: "職業", format: "text" },
  { key: "likes", label: "好きなもの", format: "chips" },
  { key: "personality", label: "性格", format: "list" },
  { key: "background", label: "誕生の背景・ストーリー", format: "list" },
  { key: "foundAt", label: "発見場所", format: "text" },
  { key: "imageColors", label: "イメージカラー", format: "chips" },
  { key: "motifs", label: "モチーフ", format: "chips" },
  { key: "accessories", label: "アクセサリー", format: "chips" },
];

const screens = {
  start: document.getElementById("diagnosis-start"),
  question: document.getElementById("diagnosis-question"),
  result: document.getElementById("diagnosis-result"),
};
const startButton = document.getElementById("diagnosis-start-button");
const progressText = document.getElementById("diagnosis-progress-text");
const progressBar = document.getElementById("diagnosis-progress-bar");
const questionNumber = document.getElementById("diagnosis-question-number");
const questionText = document.getElementById("diagnosis-question-text");
const optionList = document.getElementById("diagnosis-options");
const backButton = document.getElementById("diagnosis-back");

let answers = [];
let currentIndex = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function isEmpty(value) {
  return value === null || value === undefined || (Array.isArray(value) && value.length === 0) || value === "";
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => {
    screen.hidden = key !== name;
  });
  window.scrollTo({ top: 0 });
  const heading = screens[name].querySelector("[data-focus]");
  if (heading) heading.focus({ preventScroll: true });
}

// ===== 質問画面 =====
function renderQuestion() {
  const question = QUESTIONS[currentIndex];
  const total = QUESTIONS.length;
  progressText.textContent = `${currentIndex + 1} / ${total}`;
  progressBar.style.width = `${((currentIndex + 1) / total) * 100}%`;
  progressBar.parentElement.setAttribute("aria-valuenow", String(currentIndex + 1));
  questionNumber.textContent = `Q${currentIndex + 1}`;
  questionText.textContent = question.text;

  optionList.replaceChildren();
  question.options.forEach((option, index) => {
    const item = el("li");
    const button = el("button", "diagnosis-option");
    button.type = "button";
    if (answers[currentIndex] === index) button.classList.add("is-selected");
    button.append(el("span", "diagnosis-option-mark", option.id), el("span", "diagnosis-option-label", option.label));
    button.addEventListener("click", () => selectOption(index));
    item.append(button);
    optionList.append(item);
  });

  backButton.textContent = currentIndex === 0 ? "はじめの画面にもどる" : "前の質問にもどる";
}

function selectOption(index) {
  answers[currentIndex] = index;
  if (currentIndex < QUESTIONS.length - 1) {
    currentIndex += 1;
    renderQuestion();
    window.scrollTo({ top: 0 });
    questionText.focus({ preventScroll: true });
  } else {
    showResult();
  }
}

function goBack() {
  if (currentIndex === 0) {
    showScreen("start");
    return;
  }
  currentIndex -= 1;
  renderQuestion();
  questionText.focus({ preventScroll: true });
}

// ===== 結果 =====
function buildResult() {
  const scores = scoreAnswers(QUESTIONS, answers);
  const type = determineType(scores.ratio);
  const ranking = rankCharacters(QUESTIONS, CHARACTERS, scores);
  return { answers: [...answers], scores, type, ranking, top: ranking[0] };
}

// 将来、診断結果を保存する場合はここで行う（今は保存しない）
function onResultReady(result) {
  return result;
}

function portrait(character, className) {
  const frame = el("div", className);
  if (character.image) {
    const img = el("img");
    img.src = character.image;
    img.alt = character.name;
    img.loading = "lazy";
    frame.append(img);
  } else {
    frame.classList.add("is-empty");
    frame.append(el("span", "diagnosis-portrait-empty", "イラスト準備中"));
  }
  return frame;
}

function renderHero(top) {
  const card = el("section", `diagnosis-card diagnosis-hero is-${top.id}`);
  const heroPortrait = portrait(top.character, "diagnosis-hero-portrait");
  heroPortrait.querySelector("img")?.removeAttribute("loading");
  const kicker = el("p", "diagnosis-hero-kicker", "あなたと相性ぴったりの地底人は…");
  const name = el("h1", "diagnosis-hero-name", top.character.name);
  name.tabIndex = -1;
  name.dataset.focus = "";
  const percent = el("p", "diagnosis-hero-percent");
  percent.append("相性 ", el("strong", "", `${top.percent}`), "%");
  card.append(heroPortrait, kicker, name, percent);
  return card;
}

function renderAnnounce(result) {
  const card = el("section", "diagnosis-card diagnosis-announce");
  card.append(
    el("h2", "diagnosis-section-title", "結果発表"),
    el("p", "diagnosis-announce-text", `${result.type.phrase}あなたは、${result.top.character.name}と気が合いそう！`),
  );
  return card;
}

function renderType(type) {
  const card = el("section", "diagnosis-card diagnosis-type");
  const traits = el("ul", "diagnosis-chips");
  type.traits.forEach((trait) => traits.append(el("li", "diagnosis-chip", trait)));
  card.append(
    el("h2", "diagnosis-section-title", "あなたの性格タイプ"),
    el("p", "diagnosis-type-name", type.name),
    el("p", "diagnosis-type-catch", type.catch),
    traits,
  );
  return card;
}

function renderParams(stars) {
  const card = el("section", "diagnosis-card diagnosis-params");
  const list = el("ul", "diagnosis-param-list");
  PARAMS.forEach((param) => {
    const value = stars[param.key];
    const row = el("li", "diagnosis-param-row");
    const starText = el("span", "diagnosis-stars");
    starText.setAttribute("aria-label", `★${value}（5段階中）`);
    const filled = el("span", "diagnosis-stars-on", "★".repeat(value));
    const empty = el("span", "diagnosis-stars-off", "★".repeat(5 - value));
    filled.setAttribute("aria-hidden", "true");
    empty.setAttribute("aria-hidden", "true");
    starText.append(filled, empty);
    row.append(el("span", "diagnosis-param-label", param.label), starText);
    list.append(row);
  });
  card.append(el("h2", "diagnosis-section-title", "あなたの性格パラメーター"), list);
  return card;
}

function renderHomestay(characterId) {
  const data = HOMESTAY[characterId];
  if (!data || isEmpty(data.items)) return null;
  const note = el("section", `diagnosis-note diagnosis-homestay is-${data.format}`);
  const list = el("ul", "diagnosis-homestay-list");
  data.items.forEach((item) => {
    const row = el("li", "diagnosis-homestay-item");
    row.append(el("span", "diagnosis-homestay-label", item.label), el("p", "diagnosis-homestay-text", item.text));
    list.append(row);
  });
  note.append(
    el("p", "diagnosis-note-kicker", "ホームステイ予想"),
    el("h2", "diagnosis-note-title", HOMESTAY_HEADINGS[data.format] || ""),
    list,
  );
  return note;
}

function renderProfile(character) {
  const profile = character.profile || {};
  const rows = PROFILE_FIELDS.filter((field) => !isEmpty(profile[field.key]));
  if (rows.length === 0) return null;

  const note = el("section", "diagnosis-note diagnosis-profile");
  const list = el("dl", "diagnosis-profile-list");
  rows.forEach((field) => {
    const value = profile[field.key];
    const dd = el("dd");
    if (field.format === "list") {
      const ul = el("ul", "diagnosis-profile-lines");
      value.forEach((line) => ul.append(el("li", "", line)));
      dd.append(ul);
    } else if (field.format === "chips") {
      const ul = el("ul", "diagnosis-chips is-small");
      (Array.isArray(value) ? value : [value]).forEach((text) => ul.append(el("li", "diagnosis-chip", text)));
      dd.append(ul);
    } else {
      dd.textContent = value;
    }
    const label =
      character.id === "deepy" && field.key === "foundAt" ? "発見日" : field.label;
    list.append(el("dt", "", label), dd);
  });
  note.append(el("p", "diagnosis-note-kicker", "地底調査ノート"), el("h2", "diagnosis-note-title", "プロフィール"), list);
  return note;
}

function renderRanking(ranking) {
  const card = el("section", "diagnosis-card diagnosis-ranking");
  const list = el("ol", "diagnosis-ranking-list");
  ranking.forEach((entry) => {
    const item = el("li", `diagnosis-ranking-item is-${entry.id}`);
    const bar = el("span", "diagnosis-ranking-bar");
    const fill = el("span", "diagnosis-ranking-fill");
    fill.style.width = `${entry.percent}%`;
    bar.append(fill);
    const body = el("span", "diagnosis-ranking-body");
    body.append(el("span", "diagnosis-ranking-name", entry.character.name), bar);
    item.append(
      el("span", "diagnosis-ranking-rank", `${entry.rank}`),
      portrait(entry.character, "diagnosis-ranking-thumb"),
      body,
      el("span", "diagnosis-ranking-percent", `${entry.percent}%`),
    );
    list.append(item);
  });
  card.append(el("h2", "diagnosis-section-title", "7匹との相性ランキング"), list);
  return card;
}

function renderActions() {
  const actions = el("div", "diagnosis-actions");
  const retry = el("button", "diagnosis-button is-primary", "もう一度診断する");
  retry.type = "button";
  retry.addEventListener("click", restart);
  const home = el("a", "diagnosis-button is-secondary", "サイトへもどる");
  home.href = "./index.html?from=sindan";
  actions.append(retry, home);
  return actions;
}

function showResult() {
  const result = onResultReady(buildResult());
  const container = screens.result;
  container.replaceChildren(
    ...[
      renderHero(result.top),
      renderAnnounce(result),
      renderType(result.type),
      renderParams(result.scores.stars),
      renderHomestay(result.top.id),
      renderProfile(result.top.character),
      renderRanking(result.ranking),
      renderActions(),
    ].filter(Boolean),
  );
  showScreen("result");
}

function start() {
  answers = [];
  currentIndex = 0;
  renderQuestion();
  showScreen("question");
}

function restart() {
  screens.result.replaceChildren();
  answers = [];
  currentIndex = 0;
  showScreen("start");
}

startButton.addEventListener("click", start);
backButton.addEventListener("click", goBack);
