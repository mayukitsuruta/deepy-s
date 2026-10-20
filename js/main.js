import { db, auth } from "./firebase.js";

import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

import { signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

import {
  EmailAuthProvider,
  linkWithCredential,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

console.log("DEEPY’sのFirebase接続準備ができました！");
console.log("Firestore:", db);

import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

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

const homeScreen = document.getElementById("home-screen");
const homeNickname = document.getElementById("home-nickname");

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

const logoutButton = document.getElementById("logout-button");

const openRegister = document.getElementById("open-register");
const closeRegister = document.getElementById("close-register");
const registerModal = document.getElementById("register-modal");
const registerForm = document.getElementById("register-form");
const registerMessage = document.getElementById("register-message");
const registerSubmit = document.getElementById("register-submit");

const signinScreen = document.getElementById("signin-screen");
const loginButton = document.getElementById("login-button");
const signinForm = document.getElementById("signin-form");
const signinMessage = document.getElementById("signin-message");
const signinBack = document.getElementById("signin-back");
let storyIndex = 0;

const newRegisterButton = document.getElementById("register-button");
const registerNicknameArea = document.getElementById("register-nickname-area");
const registerNickname = document.getElementById("register-nickname");

// 画面の切り替え
function showScreen(screen) {
  firstView.hidden = true;
  storyScreen.hidden = true;
  loginScreen.hidden = true;
  guestScreen.hidden = true;
  homeScreen.hidden = true;
  signinScreen.hidden = true;

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

    homeNickname.textContent = nickname;
    showScreen(homeScreen);

    // 次はここから地底のホーム画面へ進める予定
  } catch (error) {
    console.error("ゲスト登録エラー:", error);
    alert("登録に失敗しました。コンソールを確認してね。");
  } finally {
    submitButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  const confirmed = confirm(
    "地底生活を終了しますか？\n" +
      "ゲストのまま終了すると、別の端末では続きを遊べません。",
  );

  if (!confirmed) return;

  try {
    // Firebaseからログアウト
    await signOut(auth);

    // 入力欄を空にする
    guestName.value = "";
    homeNickname.textContent = "ゲストさん";

    // 次の来場者のために最初の画面へ
    showScreen(firstView);

    alert("地底生活を終了しました！");
  } catch (error) {
    console.error("ログアウトエラー:", error);
    alert("ログアウトに失敗しました。");
  }
});

let registerMode = "guest";

// ホーム画面から登録する場合
openRegister.addEventListener("click", () => {
  registerMode = "guest";

  // ゲストはすでにニックネームがある
  registerNicknameArea.hidden = true;
  registerNickname.required = false;

  registerMessage.textContent = "";
  registerModal.hidden = false;

  document.getElementById("register-email").focus();
});

// 最初から新規登録する場合
newRegisterButton.addEventListener("click", () => {
  registerMode = "new";

  // 新規登録ではニックネームを入力
  registerNicknameArea.hidden = false;
  registerNickname.required = true;

  registerMessage.textContent = "";
  registerModal.hidden = false;

  registerNickname.focus();
});

// ポップアップを閉じる
closeRegister.addEventListener("click", () => {
  registerModal.hidden = true;
});

// ポップアップの外側をクリックしたら閉じる
registerModal.addEventListener("click", (event) => {
  if (event.target === registerModal) {
    registerModal.hidden = true;
  }
});

// ゲストアカウントを正式登録
registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  const nickname = registerNickname.value.trim();

  registerSubmit.disabled = true;
  registerMessage.textContent = "登録中...";

  try {
    let user;

    if (registerMode === "guest") {
      // ゲストのデータを引き継いで正式登録
      user = auth.currentUser;

      if (!user || !user.isAnonymous) {
        throw new Error("ゲストとして参加してから登録してね。");
      }

      const credential = EmailAuthProvider.credential(email, password);

      await linkWithCredential(user, credential);
    } else {
      // 最初から新規登録
      if (!nickname) {
        throw new Error("ニックネームを入力してね。");
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      user = userCredential.user;

      // Firestoreにユーザー情報を保存
      await setDoc(doc(db, "users", user.uid), {
        nickname: nickname,
        friendshipPoints: 0,
        createdAt: serverTimestamp(),
      });
    }

    // Firestoreから登録情報を取得
    const userSnapshot = await getDoc(doc(db, "users", user.uid));
    const userData = userSnapshot.data();

    homeNickname.textContent = userData.nickname || "ゲストさん";
    document.getElementById("friendship-value").textContent =
      userData.friendshipPoints ?? 0;

    openRegister.hidden = true;

    registerModal.hidden = true;
    registerForm.reset();
    registerMessage.textContent = "";

    showScreen(homeScreen);

    alert("地底住民登録が完了したよ！");
  } catch (error) {
    console.error("登録エラー:", error);

    if (error.code === "auth/email-already-in-use") {
      registerMessage.textContent =
        "このメールアドレスはすでに登録されているよ。";
    } else if (error.code === "auth/weak-password") {
      registerMessage.textContent = "パスワードをもう少し長くしてね。";
    } else if (error.code === "auth/invalid-email") {
      registerMessage.textContent = "メールアドレスを確認してね。";
    } else {
      registerMessage.textContent = error.message || "登録できませんでした。";
    }
  } finally {
    registerSubmit.disabled = false;
  }
});

// ログイン画面を表示
loginButton.addEventListener("click", () => {
  signinMessage.textContent = "";
  showScreen(signinScreen);
});

// もどるボタン
signinBack.addEventListener("click", () => {
  showScreen(loginScreen);
});

// メールアドレス＋パスワードでログイン
signinForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("signin-email").value.trim();
  const password = document.getElementById("signin-password").value;
  const submitButton = document.getElementById("signin-submit");

  submitButton.disabled = true;
  signinMessage.textContent = "ログイン中...";

  try {
    // Firebase Authenticationでログイン
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );

    const user = userCredential.user;

    // Firestoreからユーザー情報を取得
    const userRef = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists()) {
      signinMessage.textContent = "ユーザー情報が見つかりません。";
      return;
    }

    const userData = userSnapshot.data();

    // ホーム画面にデータを反映
    homeNickname.textContent = userData.nickname || "ゲストさん";

    const friendshipValue = document.getElementById("friendship-value");
    friendshipValue.textContent = userData.friendshipPoints ?? 0;

    // 登録済みなのでアカウント登録ボタンを隠す
    openRegister.hidden = true;

    signinForm.reset();
    signinMessage.textContent = "";

    // ホーム画面へ
    showScreen(homeScreen);
  } catch (error) {
    console.error("ログインエラー:", error);
    signinMessage.textContent =
      "ログインできませんでした。メールアドレスとパスワードを確認してね。";
  } finally {
    submitButton.disabled = false;
  }
});
