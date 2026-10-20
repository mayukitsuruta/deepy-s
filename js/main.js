import { db, auth } from "./firebase.js";

import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

console.log("DEEPY’sのFirebase接続準備ができました！");
console.log("Firestore:", db);

// 画面を取得
const firstView = document.getElementById("first-view");
const storyScreen = document.getElementById("story-screen");
const loginScreen = document.getElementById("login-screen");

const startButton = document.getElementById("start-story");
const nextButton = document.getElementById("next-story");
const storyText = document.getElementById("story-text");
const dots = document.querySelectorAll(".dot");
// ゲスト参加画面
const guestScreen = document.getElementById("guest-screen");
const guestButton = document.getElementById("guest-button");
const backButton = document.getElementById("back-to-login");

const guestForm = document.getElementById("guest-form");
const guestName = document.getElementById("guest-name");

// 導入ストーリー（仮の文章）
const stories = [
  `実は、地底人はずっと昔から地球の地下で暮らしていた。

ピラミッドができたのも、地底から石を「よいしょ、よいしょ」と
押し上げていた地底人のおかげ……！？`,

  `新たに地底人が発見され、人間社会と地底社会の交流を図るために
地底人・地上人交流キャンぺーンが行われることになった。`,

  `両者の環境に適合できるか、
また文化や生活リズムなどを学び理解を深めるために、
あなたは交換留学生として地底へと向かう！！！`,
];

let storyIndex = 0;

// 画面の切り替え
function showScreen(screen) {
  firstView.hidden = true;
  storyScreen.hidden = true;
  loginScreen.hidden = true;
  guestScreen.hidden = true;

  screen.hidden = false;
}

// ストーリー表示
function updateStory() {
  storyText.textContent = stories[storyIndex];

  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === storyIndex);
  });

  nextButton.textContent =
    storyIndex === stories.length - 1 ? "地底に行く！" : "click！";
}

// ファーストビュー → ストーリー
startButton.addEventListener("click", () => {
  storyIndex = 0;
  updateStory();
  showScreen(storyScreen);
});

// ストーリーを進める
nextButton.addEventListener("click", () => {
  if (storyIndex < stories.length - 1) {
    storyIndex++;
    updateStory();
  } else {
    showScreen(loginScreen);
  }
});

// 初期表示
showScreen(firstView);

// 「ゲストとして遊ぶ」をクリック
guestButton.addEventListener("click", () => {
  showScreen(guestScreen);
});

// 「もどる」をクリック
backButton.addEventListener("click", () => {
  showScreen(loginScreen);
});

// ゲスト登録
guestForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const nickname = guestName.value.trim();

  if (!nickname) {
    alert("ニックネームを入力してね！");
    return;
  }

  const submitButton = guestForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    // Firebaseで匿名ログイン
    const userCredential = await signInAnonymously(auth);
    const user = userCredential.user;

    // ユーザーの保存先
    const userRef = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userRef);

    // 初めてのユーザーだけ登録
    if (!userSnapshot.exists()) {
      await setDoc(userRef, {
        nickname: nickname,
        friendshipPoints: 0,
        createdAt: serverTimestamp(),
      });
    }

    alert("地底生活へようこそ、" + nickname + "！");

    // 次はここから地底のホーム画面へ進める予定
  } catch (error) {
    console.error("ゲスト登録エラー:", error);
    alert("登録に失敗しました。コンソールを確認してね。");
  } finally {
    submitButton.disabled = false;
  }
});
