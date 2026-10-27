import { db, auth } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
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
  restoreAuth();
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

// 「ゲストとして遊ぶ」をクリック（1ブラウザ＝1ゲスト：既存データがあればそのまま復帰）
let pendingGuestDocData = null;
const PROFILE_CACHE_KEY = "deepys-profile";
let authRestore = null;
let guestUserPromise = null;
let profilePrefetch = null;
let profilePrefetchUid = null;
let sessionVersion = 0;

function readProfileCache(uid) {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || "null");
    if (!parsed || parsed.uid !== uid || !parsed.data) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeProfileCache(uid, data) {
  if (!uid || !data) return;
  const plain = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value == null || ["string", "number", "boolean"].includes(typeof value)) {
      plain[key] = value;
      return;
    }
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      plain[key] = value;
    }
  });
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ uid, data: plain }));
  } catch (error) {
    console.warn("プロフィールの端末保存に失敗:", error);
  }
}

function clearProfileCache() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // 端末に保存できない環境では次回も通信で復元する
  }
}

function prefetchProfile(user) {
  if (!user) return Promise.resolve(null);
  if (profilePrefetch && profilePrefetchUid === user.uid) return profilePrefetch;

  const cached = readProfileCache(user.uid);
  if (cached) pendingGuestDocData = cached;

  profilePrefetchUid = user.uid;
  const version = sessionVersion;
  profilePrefetch = getDoc(doc(db, "users", user.uid))
    .then((snapshot) => {
      if (version !== sessionVersion || auth.currentUser?.uid !== user.uid) {
        return pendingGuestDocData;
      }
      if (snapshot.exists()) {
        pendingGuestDocData = snapshot.data();
        writeProfileCache(user.uid, pendingGuestDocData);
      }
      if (pendingGuestDocData && currentUserId === user.uid && !homeScreen.hidden) {
        renderUserData(pendingGuestDocData);
      }
      return pendingGuestDocData;
    })
    .catch((error) => {
      console.warn("プロフィールの先読みに失敗:", error);
      return pendingGuestDocData;
    });
  return profilePrefetch;
}

// 物語を読んでいる間に、前回のログイン状態とプロフィールを先に取っておく
function restoreAuth() {
  if (!authRestore) {
    const version = sessionVersion;
    authRestore = auth
      .authStateReady()
      .then(() => {
        if (version !== sessionVersion) return null;
        const user = auth.currentUser;
        if (!user) return null;
        currentUserId = user.uid;
        return prefetchProfile(user);
      })
      .catch((error) => {
        console.warn("ログイン状態の復元に失敗:", error);
        authRestore = null;
        return null;
      });
  }
  return authRestore;
}

function ensureGuestUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (!guestUserPromise) {
    const version = sessionVersion;
    guestUserPromise = auth
      .authStateReady()
      .then(async () => {
        if (version !== sessionVersion) return auth.currentUser;
        if (auth.currentUser) return auth.currentUser;
        const credential = await signInAnonymously(auth);
        if (version === sessionVersion) currentUserId = credential.user.uid;
        return credential.user;
      })
      .catch((error) => {
        guestUserPromise = null;
        throw error;
      });
  }
  return guestUserPromise;
}

restoreAuth();

function rememberAndEnter(user, userData) {
  pendingGuestDocData = userData;
  writeProfileCache(user.uid, userData);
  openRegister.hidden = !user.isAnonymous;
  enterHomeWithUser(user.uid, userData);
}

guestButton.addEventListener("click", () => {
  const user = auth.currentUser;
  const known = pendingGuestDocData || (user && readProfileCache(user.uid));

  if (user && known?.nickname) {
    rememberAndEnter(user, known);
    prefetchProfile(user);
    return;
  }

  // 通信完了を待たずに名前入力へ進む。戻ってきた人は先読みが終わり次第ホームへ
  showScreen(guestScreen);
  guestName.focus();

  ensureGuestUser()
    .then((signedIn) => prefetchProfile(signedIn))
    .then(() => {
      const active = auth.currentUser;
      if (
        active &&
        pendingGuestDocData?.nickname &&
        !guestScreen.hidden &&
        !guestName.value.trim()
      ) {
        rememberAndEnter(active, pendingGuestDocData);
      }
    })
    .catch((error) => {
      console.error("ゲストログイン確認エラー:", error);
    });
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
    // 名前入力中に始めておいたログインを使う。未完了ならここだけ待つ
    const user = await ensureGuestUser();
    if (!pendingGuestDocData) await prefetchProfile(user);
    const userRef = doc(db, "users", user.uid);
    const isNew = !pendingGuestDocData;
    const userData = {
      ...(pendingGuestDocData || {}),
      nickname,
      avatar: pendingGuestDocData?.avatar || "pink",
      friendshipPoints: pendingGuestDocData?.friendshipPoints ?? 0,
      bio:
        pendingGuestDocData?.bio ||
        "地底でのんびり暮らしてます。よろしくお願いします！",
      tags: pendingGuestDocData?.tags || ["デザイン", "カフェ巡り", "音楽"],
      houseLocation: pendingGuestDocData?.houseLocation || "第3層・右下エリア",
      isOnline: true,
      lastActiveMs: Date.now(),
    };

    rememberAndEnter(user, userData);

    if (isNew) {
      await setDoc(userRef, { ...userData, createdAt: serverTimestamp() });
    } else {
      await setDoc(
        userRef,
        {
          nickname,
          isOnline: true,
          lastActiveMs: userData.lastActiveMs,
        },
        { merge: true },
      );
    }
  } catch (error) {
    console.error("ゲスト登録エラー:", error);
    alert("登録に失敗しました。コンソールを確認してね。");
  } finally {
    submitButton.disabled = false;
  }
});

logoutButton.addEventListener("click", () => {
  const confirmed = confirm(
    "地底生活を終了しますか？\n" +
      "ゲストのまま終了すると、別の端末では続きを遊べません。",
  );

  if (!confirmed) return;

  stopCamera();
  const presence = sendPresenceHeartbeat(false);
  sessionVersion += 1;
  currentUserId = null;
  pendingGuestDocData = null;
  guestUserPromise = null;
  profilePrefetch = null;
  profilePrefetchUid = null;
  authRestore = null;
  clearProfileCache();
  guestName.value = "";
  homeNickname.textContent = "ゲストさん";
  showScreen(firstView);

  presence
    .catch((error) => {
      console.warn("オンライン状態の更新に失敗:", error);
    })
    .then(() => signOut(auth))
    .catch((error) => {
      console.error("ログアウトエラー:", error);
    });
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
      user = auth.currentUser;
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
    }

    const userData =
      registerMode === "guest"
        ? { ...currentUserData, isOnline: true, lastActiveMs: Date.now() }
        : {
            nickname,
            avatar: "pink",
            friendshipPoints: 0,
            bio: "地底でのんびり暮らしてます。よろしくお願いします！",
            tags: ["デザイン", "カフェ巡り", "音楽"],
            houseLocation: "第3層・右下エリア",
            isOnline: true,
            lastActiveMs: Date.now(),
          };

    if (registerMode === "new") {
      setDoc(doc(db, "users", user.uid), {
        ...userData,
        createdAt: serverTimestamp(),
      }).catch((error) => {
        console.error("ユーザー情報の保存エラー:", error);
      });
    }

    registerModal.hidden = true;
    registerForm.reset();
    registerMessage.textContent = "";
    rememberAndEnter(user, userData);
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

// ログイン画面を表示。前回のセッションが残っていれば、入力を待たずにホームへ
loginButton.addEventListener("click", () => {
  const user = auth.currentUser;
  const known = pendingGuestDocData || (user && readProfileCache(user.uid));
  if (user && !user.isAnonymous && known?.nickname) {
    rememberAndEnter(user, known);
    prefetchProfile(user);
    return;
  }

  signinMessage.textContent = "";
  showScreen(signinScreen);
  document.getElementById("signin-email").focus();
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
    guestUserPromise = null;
    const cached = readProfileCache(user.uid);

    signinForm.reset();
    signinMessage.textContent = "";

    if (cached?.nickname) {
      rememberAndEnter(user, cached);
      prefetchProfile(user);
      return;
    }

    const userSnapshot = await getDoc(doc(db, "users", user.uid));
    if (!userSnapshot.exists()) {
      signinMessage.textContent = "ユーザー情報が見つかりません。";
      showScreen(signinScreen);
      return;
    }

    rememberAndEnter(user, userSnapshot.data());
  } catch (error) {
    console.error("ログインエラー:", error);
    signinMessage.textContent =
      "ログインできませんでした。メールアドレスとパスワードを確認してね。";
  } finally {
    submitButton.disabled = false;
  }
});

// =========================================
// 交流スペース・オンライン人数・プロフィール・掲示板機能
// =========================================
const navItems = document.querySelectorAll(".home-nav .nav-item");
const homeViewContent = document.getElementById("home-view-content");
const spaceViewContent = document.getElementById("space-view-content");
const cameraViewContent = document.getElementById("camera-view-content");
const storyViewContent = document.getElementById("story-view-content");
const zukanViewContent = document.getElementById("zukan-view-content");

document.querySelectorAll(".zukan-portrait img").forEach((img) => {
  const markMissing = () => {
    img.parentElement.classList.add("is-missing");
  };
  img.addEventListener("error", markMissing);
  if (img.complete && img.naturalWidth === 0) markMissing();
});
const topbarTitleArea = document.getElementById("topbar-title-area");
const topbarAvatar = document.getElementById("topbar-avatar");
const onlineCountEl = document.getElementById("online-count");
const friendshipValueEl = document.getElementById("friendship-value");

// ① 私の家
const houseLocationText = document.getElementById("house-location-text");

// ② プロフィール
const profileAvatarDisplay = document.getElementById("profile-avatar-display");
const profileNickname = document.getElementById("profile-nickname");
const profileBio = document.getElementById("profile-bio");
const profileTags = document.getElementById("profile-tags");
const toggleProfileEditBtn = document.getElementById("toggle-profile-edit");
const profileEditForm = document.getElementById("profile-edit-form");
const profileAvatarInput = document.getElementById("profile-avatar-input");
const profileNicknameInput = document.getElementById("profile-nickname-input");
const profileBioInput = document.getElementById("profile-bio-input");
const profileTagsInput = document.getElementById("profile-tags-input");
const cancelProfileEditBtn = document.getElementById("cancel-profile-edit");

// ③ 掲示板
const boardPostForm = document.getElementById("board-post-form");
const boardMessageInput = document.getElementById("board-message-input");
const boardList = document.getElementById("board-list");
const toggleBoardMoreBtn = document.getElementById("toggle-board-more");

// アバターカラー定義（純色アイコン用）
const AVATAR_PALETTE = {
  pink: "#f2a6b8",
  green: "#9ed18b",
  cream: "#ecd9b5",
  purple: "#b89fd9",
  orange: "#f4ad7b",
};

function getAvatarSvg(avatarKey = "pink", size = 24) {
  const color = AVATAR_PALETTE[avatarKey] || AVATAR_PALETTE.pink;
  return `
    <svg viewBox="0 0 36 36" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="18" cy="18" r="18" fill="${color}" />
    </svg>
  `;
}

let currentUserId = null;
let currentUserData = {
  nickname: "ゲスト",
  avatar: "pink",
  friendshipPoints: 0,
  bio: "地底でのんびり暮らしてます。よろしくお願いします！",
  tags: ["デザイン", "カフェ巡り", "音楽"],
  houseLocation: "第3層・右下エリア",
};
let unsubscribeBoard = null;
let unsubscribeOnlineUsers = null;
let heartbeatTimer = null;
let latestUsersDocs = [];

const ONLINE_TIMEOUT_MS = 90 * 1000;

// ホーム画面内のサブビュー切り替え（ホーム / 交流スペース）
function switchUndergroundView(viewName) {
  homeScreen.classList.toggle("camera-mode", viewName === "camera");
  homeScreen.classList.toggle("space-mode", viewName === "space");
  homeScreen.classList.toggle("story-mode", viewName === "story");
  navItems.forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.dataset.view === viewName || (viewName === "story" && btn.dataset.view === "home"),
    );
  });

  homeViewContent.hidden = viewName !== "home";
  spaceViewContent.hidden = viewName !== "space";
  cameraViewContent.hidden = viewName !== "camera";
  if (storyViewContent) storyViewContent.hidden = viewName !== "story";
  if (zukanViewContent) zukanViewContent.hidden = viewName !== "zukan";

  if (viewName === "space") {
    if (topbarTitleArea) topbarTitleArea.textContent = "";
    requestAnimationFrame(() => {
      updateMapScrollbar();
    });
  } else if (viewName === "camera") {
    if (topbarTitleArea) topbarTitleArea.textContent = "地底の思い出を写真に残そう。";
  } else if (topbarTitleArea) {
    topbarTitleArea.textContent = "";
  }

  if (viewName === "home") updateHitopyPortrait();
}

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    if (view === "home" || view === "space" || view === "camera" || view === "zukan") {
      switchUndergroundView(view);
      if (view !== "camera") stopCamera();
    } else {
      alert("この画面は現在準備中です！");
    }
  });
});

const chippyStoryLines = [
  "やあ！　上層まで来てくれたんだね。ぼくはCHIPPY。",
  "仕事は土吸収員。じゃまな土をこのホースですーって吸い込んで、家や道を作ってるんだ。",
  "今日の依頼は、道の土にまぎれたクリスタルを見つけること。誰かが落とした、キラキラなんだ。",
  "土のかたまりが三つあるけど、見た目はどれも同じ。花や果実が埋まってることもあるよ。",
  "土をクリックすると、ぼくがすーって吸い込む。クリスタルが出てきたら、クリアだ！",
  "準備はいいかな。ゲームスタートを押して、いっしょに探そう。",
];

const chippyItemArt = {
  crystal: "./images/chippy-crystal.png",
  flower: "./images/chippy-flower.png",
  fruit: "./images/chippy-fruit.png",
};

const chippyDialogueText = document.getElementById("chippy-dialogue-text");
const chippyDialogueNext = document.getElementById("chippy-dialogue-next");
const chippyDialogue = document.getElementById("chippy-dialogue");
const chippyStoryBack = document.getElementById("chippy-story-back");
const chippyStoryPrev = document.getElementById("chippy-story-prev");
const chippyGame = document.getElementById("chippy-game");
const chippyGameStart = document.getElementById("chippy-game-start");
const chippyClearPanel = document.getElementById("chippy-clear-panel");
const chippyReplay = document.getElementById("chippy-replay");
const chippyFinish = document.getElementById("chippy-finish");
const chippyFinishMessage = document.getElementById("chippy-finish-message");
const chippyFinishHome = document.getElementById("chippy-finish-home");
let chippyStoryIndex = 0;
let chippyGameStarted = false;
let chippyCleared = false;
let chippyShowingClear = false;

function chippyClearStorageKey() {
  return `deepys-chippy-cleared:${currentUserId || "local"}`;
}

function isChippyStoryCleared() {
  if (currentUserData?.chippyCleared) return true;
  try {
    return localStorage.getItem(chippyClearStorageKey()) === "1";
  } catch {
    return false;
  }
}

function updateHitopyPortrait() {
  const portrait = document.getElementById("hitopy-portrait");
  const card = portrait?.closest(".hitopy");
  if (!portrait || !card) return;
  const revealed = isChippyStoryCleared();
  portrait.classList.toggle("is-silhouette", !revealed);
  card.classList.toggle("is-revealed", revealed);
}

function awardChippyFriendship() {
  if (isChippyStoryCleared()) return;

  const nextPoints = Math.min(100, Number(currentUserData.friendshipPoints ?? 0) + 25);
  renderUserData({ friendshipPoints: nextPoints, chippyCleared: true });
  updateHitopyPortrait();

  try {
    localStorage.setItem(chippyClearStorageKey(), "1");
  } catch {
    // 保存できない場合も、この画面の表示は更新済み
  }

  if (!currentUserId) return;
  writeProfileCache(currentUserId, currentUserData);
  setDoc(
    doc(db, "users", currentUserId),
    { friendshipPoints: nextPoints, chippyCleared: true },
    { merge: true },
  ).catch((error) => {
    console.error("友情ポイントの保存エラー:", error);
  });
}

function shuffleChippyItems(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function resetChippyGame() {
  chippyGameStarted = false;
  chippyCleared = false;
  storyViewContent?.classList.remove("is-playing");
  if (chippyGame) {
    chippyGame.hidden = true;
    chippyGame.replaceChildren();
  }
  if (chippyFinish) chippyFinish.hidden = true;
}

function updateChippyPrev() {
  const inDialogue = !chippyGameStarted && !chippyShowingClear;
  chippyStoryPrev.hidden = !inDialogue;
  chippyStoryPrev.disabled = chippyStoryIndex <= 0;
}

function renderChippyStory() {
  const isLast = chippyStoryIndex >= chippyStoryLines.length - 1;
  const showStart = isLast && !chippyGameStarted;
  chippyDialogueText.textContent = chippyStoryLines[chippyStoryIndex];
  chippyGameStart.hidden = !showStart;
  chippyDialogueNext.hidden = showStart;
  chippyDialogueNext.textContent = "click";
  chippyDialogueNext.classList.toggle("is-more", !isLast && !showStart);
  updateChippyPrev();
}

function showChippyFinish(message) {
  chippyFinishMessage.textContent = message;
  chippyDialogue.hidden = true;
  chippyFinish.hidden = false;
  chippyFinishHome.focus();
}

function sayChippy(message, hint) {
  chippyDialogueText.textContent = message;
  chippyDialogueNext.hidden = false;
  chippyDialogueNext.textContent = hint;
  chippyDialogueNext.classList.remove("is-more");
  updateChippyPrev();
}

function showChippyClearScreen() {
  chippyShowingClear = true;
  resetChippyGame();
  chippyDialogue.hidden = true;
  chippyClearPanel.hidden = false;
  storyViewContent.classList.add("is-cleared");
  updateChippyPrev();
  switchUndergroundView("story");
}

function startChippyStory() {
  chippyStoryIndex = 0;
  chippyShowingClear = false;
  chippyDialogue.hidden = false;
  chippyClearPanel.hidden = true;
  storyViewContent.classList.remove("is-cleared");
  resetChippyGame();
  renderChippyStory();
  switchUndergroundView("story");
}

function openChippyStory() {
  if (isChippyStoryCleared()) {
    showChippyClearScreen();
    return;
  }
  startChippyStory();
}

function advanceChippyStory() {
  if (chippyShowingClear || chippyGameStarted) return;
  if (chippyStoryIndex >= chippyStoryLines.length - 1) return;
  chippyStoryIndex += 1;
  renderChippyStory();
}

function rewindChippyStory() {
  if (chippyShowingClear || chippyGameStarted || chippyStoryIndex <= 0) return;
  chippyStoryIndex -= 1;
  renderChippyStory();
}

function absorbChippyMound(mound) {
  if (mound.classList.contains("is-open")) return;
  mound.classList.add("is-open");
  mound.disabled = true;

  const item = mound.dataset.item;
  if (item === "crystal") {
    chippyCleared = true;
    mound.classList.add("is-clear");
    mound.setAttribute("aria-label", "クリスタル");
    const alreadyCleared = isChippyStoryCleared();
    awardChippyFriendship();
    showChippyFinish(
      alreadyCleared
        ? "ありがとう！　またクリスタルを見つけてくれたね。友情ポイントは、このまえ渡してあるよ。"
        : "ありがとう！　探してたクリスタルを見つけてくれて、ほんとうに助かったよ。友情ポイントを25%あげるね。",
    );
    return;
  }

  mound.setAttribute("aria-label", item === "flower" ? "花" : "果実");
  if (!chippyCleared) {
    sayChippy("残念、これじゃないみたいだ。", "ほかの土も吸ってみよう");
  }
}

function startChippyGame() {
  chippyGameStarted = true;
  chippyCleared = false;
  chippyGameStart.hidden = true;
  storyViewContent.classList.add("is-playing");
  chippyGame.replaceChildren();

  shuffleChippyItems(["crystal", "flower", "fruit"]).forEach((item) => {
    const mound = document.createElement("button");
    mound.type = "button";
    mound.className = "chippy-mound";
    mound.dataset.item = item;
    mound.setAttribute("aria-label", "土のかたまり");

    const itemImage = document.createElement("img");
    itemImage.className = "chippy-mound-item";
    itemImage.src = chippyItemArt[item];
    itemImage.alt = "";

    const soilImage = document.createElement("img");
    soilImage.className = "chippy-mound-soil";
    soilImage.src = "./images/chippy-soil.png";
    soilImage.alt = "";

    mound.append(itemImage, soilImage);
    mound.addEventListener("click", (event) => {
      event.stopPropagation();
      absorbChippyMound(mound);
    });
    chippyGame.append(mound);
  });

  chippyGame.hidden = false;
  sayChippy("三つのうちのひとつに、クリスタルが埋まってる。土をクリックして吸ってみて！", "土を吸おう");
}

document.querySelectorAll(".character-button[data-character='chippy']").forEach((button) => {
  button.addEventListener("click", openChippyStory);
});

storyViewContent?.addEventListener("click", (event) => {
  if (event.target.closest("#chippy-story-back, #chippy-story-prev, #chippy-game-start, #chippy-replay, #chippy-finish-home, .chippy-mound, .chippy-clear-panel, .chippy-finish")) {
    return;
  }
  advanceChippyStory();
});

chippyStoryBack?.addEventListener("click", () => {
  switchUndergroundView("home");
});

chippyStoryPrev?.addEventListener("click", (event) => {
  event.stopPropagation();
  rewindChippyStory();
});

chippyReplay?.addEventListener("click", (event) => {
  event.stopPropagation();
  startChippyStory();
});

chippyFinishHome?.addEventListener("click", (event) => {
  event.stopPropagation();
  switchUndergroundView("home");
});

chippyGameStart?.addEventListener("click", (event) => {
  event.stopPropagation();
  startChippyGame();
});

document.addEventListener("keydown", (event) => {
  if (!storyViewContent || storyViewContent.hidden) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target.closest?.("#chippy-story-back, #chippy-story-prev, #chippy-game-start, #chippy-replay, #chippy-finish-home, .chippy-mound")) return;
  event.preventDefault();
  if (!chippyFinish.hidden) {
    switchUndergroundView("home");
    return;
  }
  if (!chippyGameStart.hidden) {
    startChippyGame();
    return;
  }
  advanceChippyStory();
});

// フレーム付きカメラ（画像はこの画面内でのみ扱い、Firebaseには保存しない）
const cameraVideo = document.getElementById("camera-video");
const cameraResult = document.getElementById("camera-result");
const cameraMessage = document.getElementById("camera-message");
const startCameraButton = document.getElementById("start-camera");
const takePhotoButton = document.getElementById("take-photo");
const retakePhotoButton = document.getElementById("retake-photo");
const downloadPhotoLink = document.getElementById("download-photo");
const photoRewardDialog = document.getElementById("photo-reward-dialog");
const closePhotoRewardButton = document.getElementById("close-photo-reward");
const frameChoices = document.querySelectorAll(".frame-choice");
const frameImages = document.querySelectorAll("[data-frame-image]");
let cameraStream = null;
let selectedFrame = "frame-1";

function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  if (cameraVideo) cameraVideo.srcObject = null;
  if (cameraResult) cameraResult.hidden = true;
  if (takePhotoButton) takePhotoButton.disabled = true;
  if (retakePhotoButton) retakePhotoButton.hidden = true;
  if (downloadPhotoLink) downloadPhotoLink.hidden = true;
  if (photoRewardDialog) photoRewardDialog.hidden = true;
  if (cameraMessage) cameraMessage.hidden = true;
}

function setCameraMessage(message, visible = true) {
  cameraMessage.textContent = message;
  cameraMessage.hidden = !visible;
}

function closePhotoReward() {
  photoRewardDialog.hidden = true;
  downloadPhotoLink.focus();
}

closePhotoRewardButton?.addEventListener("click", closePhotoReward);
photoRewardDialog?.addEventListener("click", (event) => {
  if (event.target === photoRewardDialog) closePhotoReward();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !photoRewardDialog.hidden) closePhotoReward();
});

startCameraButton?.addEventListener("click", async () => {
  if (window.location.protocol === "file:" || !window.isSecureContext) {
    setCameraMessage("カメラを使うにはlocalhostまたはHTTPSでページを開いてね。index.htmlを直接開いた場合は利用できません。");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraMessage("このブラウザーではカメラを利用できません。対応ブラウザーでページを開いてね。");
    return;
  }

  startCameraButton.disabled = true;
  setCameraMessage("カメラを起動しています…");
  try {
    stopCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user" },
    });
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();
    cameraResult.hidden = true;
    takePhotoButton.disabled = false;
    retakePhotoButton.hidden = true;
    downloadPhotoLink.hidden = true;
    photoRewardDialog.hidden = true;
    setCameraMessage("", false);
  } catch (error) {
    console.error("カメラを起動できませんでした:", error);
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      setCameraMessage("カメラの許可が必要です。アドレスバー横、またはブラウザー設定でこのサイトのカメラを許可してね。");
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      setCameraMessage("カメラが見つかりません。カメラが接続されているか確認してね。");
    } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      setCameraMessage("カメラを別のアプリが使用中のようです。他のアプリを閉じてからもう一度試してね。");
    } else {
      setCameraMessage("カメラを起動できませんでした。ブラウザーとOSのカメラ許可を確認してね。");
    }
  } finally {
    startCameraButton.disabled = false;
  }
});

frameChoices.forEach((choice) => {
  choice.addEventListener("click", () => {
    selectedFrame = choice.dataset.frame;
    frameChoices.forEach((button) => {
      const isSelected = button === choice;
      button.classList.toggle("active", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });
    frameImages.forEach((image) => {
      image.hidden = image.dataset.frameImage !== selectedFrame;
    });
    // 切り替えたフレームが撮影結果にも反映されるよう、再撮影を案内する。
    if (!cameraResult.hidden) {
      cameraResult.hidden = true;
      cameraVideo.hidden = false;
      takePhotoButton.disabled = false;
      retakePhotoButton.hidden = true;
      downloadPhotoLink.hidden = true;
      photoRewardDialog.hidden = true;
      setCameraMessage("フレームを切り替えました。もう一度撮ってね！");
    }
  });
});

takePhotoButton?.addEventListener("click", () => {
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) return;
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 1280;
  const context = canvas.getContext("2d");

  // プレビューと同じく cover で中央を切り抜いて撮影する。
  const sourceRatio = cameraVideo.videoWidth / cameraVideo.videoHeight;
  const targetRatio = canvas.width / canvas.height;
  let sx = 0;
  let sy = 0;
  let sw = cameraVideo.videoWidth;
  let sh = cameraVideo.videoHeight;
  if (sourceRatio > targetRatio) {
    sw = cameraVideo.videoHeight * targetRatio;
    sx = (cameraVideo.videoWidth - sw) / 2;
  } else {
    sh = cameraVideo.videoWidth / targetRatio;
    sy = (cameraVideo.videoHeight - sh) / 2;
  }
  context.drawImage(cameraVideo, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const selectedImage = document.querySelector(`[data-frame-image="${selectedFrame}"]`);
  if (selectedImage?.complete && selectedImage.naturalWidth > 0) {
    const frameRatio = selectedImage.naturalWidth / selectedImage.naturalHeight;
    let frameSx = 0;
    let frameSy = 0;
    let frameSw = selectedImage.naturalWidth;
    let frameSh = selectedImage.naturalHeight;
    if (frameRatio > targetRatio) {
      frameSw = selectedImage.naturalHeight * targetRatio;
      frameSx = (selectedImage.naturalWidth - frameSw) / 2;
    } else {
      frameSh = selectedImage.naturalWidth / targetRatio;
      frameSy = (selectedImage.naturalHeight - frameSh) / 2;
    }
    context.drawImage(
      selectedImage,
      frameSx,
      frameSy,
      frameSw,
      frameSh,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }
  cameraResult.src = canvas.toDataURL("image/png");
  downloadPhotoLink.href = cameraResult.src;
  cameraResult.hidden = false;
  takePhotoButton.disabled = true;
  retakePhotoButton.hidden = false;
  downloadPhotoLink.hidden = false;
  photoRewardDialog.hidden = false;
  closePhotoRewardButton.focus();
  setCameraMessage("", false);
});

retakePhotoButton?.addEventListener("click", () => {
  cameraResult.hidden = true;
  takePhotoButton.disabled = !cameraStream;
  retakePhotoButton.hidden = true;
  downloadPhotoLink.hidden = true;
  photoRewardDialog.hidden = true;
  setCameraMessage("", false);
});

// ユーザー情報を右上バー・私の家・プロフィールに反映
function renderUserData(data) {
  currentUserData = { ...currentUserData, ...data };

  const avatarKey = AVATAR_PALETTE[currentUserData.avatar]
    ? currentUserData.avatar
    : "pink";

  // 右上ステータスバー
  if (topbarAvatar) {
    topbarAvatar.innerHTML = getAvatarSvg(avatarKey, 28);
  }
  homeNickname.textContent = `${currentUserData.nickname || "ゲスト"}さん`;
  if (friendshipValueEl) {
    friendshipValueEl.textContent = currentUserData.friendshipPoints ?? 0;
  }

  // ① 私の家カード
  if (houseLocationText) {
    houseLocationText.textContent =
      currentUserData.houseLocation || "第3層・右下エリア";
  }

  // ② プロフィールカード
  if (profileAvatarDisplay) {
    profileAvatarDisplay.innerHTML = getAvatarSvg(avatarKey, 52);
  }
  if (profileNickname) {
    profileNickname.textContent = currentUserData.nickname || "ゲスト";
  }
  if (profileBio) {
    profileBio.textContent =
      currentUserData.bio ||
      "地底でのんびり暮らしてます。よろしくお願いします！";
  }

  if (profileTags) {
    profileTags.innerHTML = "";
    const tagsArray = Array.isArray(currentUserData.tags)
      ? currentUserData.tags
      : ["デザイン", "カフェ巡り", "音楽"];
    tagsArray.forEach((tagText) => {
      const cleanTag = String(tagText).replace(/^#/, "").trim();
      if (!cleanTag) return;
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = `#${cleanTag}`;
      profileTags.appendChild(span);
    });
  }
}

// リアルタイムオンライン人数
function recalculateOnlineCount() {
  const now = Date.now();
  let count = 0;

  latestUsersDocs.forEach((data) => {
    if (
      data.isOnline === true &&
      typeof data.lastActiveMs === "number" &&
      now - data.lastActiveMs < ONLINE_TIMEOUT_MS
    ) {
      count++;
    }
  });

  if (currentUserId && count === 0) {
    count = 1;
  }

  if (onlineCountEl) {
    onlineCountEl.textContent = `${count}人`;
  }
}

async function sendPresenceHeartbeat(isOnline = true) {
  if (!currentUserId) return;
  try {
    const userRef = doc(db, "users", currentUserId);
    await setDoc(
      userRef,
      {
        isOnline: isOnline,
        lastActiveMs: Date.now(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn("オンライン状態の更新に失敗:", error);
  }
}

function startOnlinePresence() {
  sendPresenceHeartbeat(true);

  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    sendPresenceHeartbeat(true);
    recalculateOnlineCount();
  }, 30 * 1000);

  if (!unsubscribeOnlineUsers) {
    unsubscribeOnlineUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        latestUsersDocs = [];
        snapshot.forEach((docSnap) => {
          latestUsersDocs.push(docSnap.data());
        });
        recalculateOnlineCount();
      },
      (error) => {
        console.warn("オンライン人数の取得に失敗:", error);
        if (onlineCountEl) onlineCountEl.textContent = "1人";
      },
    );
  }
}

window.addEventListener("pagehide", () => {
  sendPresenceHeartbeat(false);
});

// 相対時間のフォーマット
function formatRelativeTime(timestamp) {
  if (!timestamp || !timestamp.toDate) return "たった今";
  const diffSec = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
  if (diffSec < 60) return "たった今";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}日前`;
}

// 掲示板のリアルタイム購読開始
function startBoardListener() {
  if (unsubscribeBoard) return;

  const postsQuery = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(20),
  );

  unsubscribeBoard = onSnapshot(
    postsQuery,
    (snapshot) => {
      boardList.innerHTML = "";

      if (snapshot.empty) {
        boardList.innerHTML =
          '<p class="board-empty">まだ投稿がありません。最初のメッセージを書いてみよう！</p>';
        return;
      }

      snapshot.forEach((docSnap) => {
        const post = docSnap.data();
        const item = document.createElement("div");
        item.className = "board-item";

        const avatarDiv = document.createElement("div");
        avatarDiv.className = "board-avatar";
        avatarDiv.innerHTML = getAvatarSvg(post.avatar || "pink", 30);

        const bodyDiv = document.createElement("div");
        bodyDiv.className = "board-body";

        const metaDiv = document.createElement("div");
        metaDiv.className = "board-meta";

        const authorSpan = document.createElement("span");
        authorSpan.className = "board-author";
        authorSpan.textContent = post.nickname || "名無しの地底人";

        const timeSpan = document.createElement("span");
        timeSpan.className = "board-time";
        timeSpan.textContent = formatRelativeTime(post.createdAt);

        const textP = document.createElement("p");
        textP.className = "board-text";
        textP.textContent = post.text || "";

        metaDiv.appendChild(authorSpan);
        metaDiv.appendChild(timeSpan);

        // 自分の投稿には削除ボタンを表示
        if (currentUserId && post.uid === currentUserId) {
          const deleteBtn = document.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.className = "board-delete-btn";
          deleteBtn.title = "この投稿を削除";
          deleteBtn.setAttribute("aria-label", "この投稿を削除");
          deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6h12Z" />
            </svg>
          `;
          deleteBtn.addEventListener("click", async () => {
            try {
              await deleteDoc(doc(db, "posts", docSnap.id));
            } catch (err) {
              console.error("投稿削除エラー:", err);
              alert("削除に失敗しました。");
            }
          });
          metaDiv.appendChild(deleteBtn);
        }

        bodyDiv.appendChild(metaDiv);
        bodyDiv.appendChild(textP);

        item.appendChild(avatarDiv);
        item.appendChild(bodyDiv);
        boardList.appendChild(item);
      });
    },
    (error) => {
      console.error("掲示板の取得エラー:", error);
      boardList.innerHTML =
        '<p class="board-empty">掲示板の読み込みに失敗しました。</p>';
    },
  );
}

// ホーム画面入場時の共通初期化
function enterHomeWithUser(uid, userData) {
  currentUserId = uid;
  renderUserData(userData || {});
  startOnlinePresence();
  startBoardListener();
  switchUndergroundView("home");
  showScreen(homeScreen);
}

// ② プロフィール：編集＆Firebase保存
function openProfileEditForm() {
  profileAvatarInput.value = AVATAR_PALETTE[currentUserData.avatar]
    ? currentUserData.avatar
    : "pink";
  profileNicknameInput.value = currentUserData.nickname || "";
  profileBioInput.value = currentUserData.bio || "";
  const tagsList = Array.isArray(currentUserData.tags)
    ? currentUserData.tags
    : [];
  profileTagsInput.value = tagsList.join(", ");
  profileEditForm.hidden = false;
}

toggleProfileEditBtn.addEventListener("click", () => {
  if (profileEditForm.hidden) {
    openProfileEditForm();
  } else {
    profileEditForm.hidden = true;
  }
});

cancelProfileEditBtn.addEventListener("click", () => {
  profileEditForm.hidden = true;
});

profileEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const newAvatar = profileAvatarInput.value;
  const newNickname = profileNicknameInput.value.trim();
  const newBio = profileBioInput.value.trim();
  const newTags = profileTagsInput.value
    .split(/[,、\s]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  if (!newNickname) return;

  const updatedFields = {
    avatar: newAvatar,
    nickname: newNickname,
    bio: newBio || "地底でのんびり暮らしてます。よろしくお願いします！",
    tags: newTags.length > 0 ? newTags : ["地底生活"],
  };

  renderUserData(updatedFields);
  writeProfileCache(currentUserId, currentUserData);
  profileEditForm.hidden = true;

  if (currentUserId) {
    try {
      const userRef = doc(db, "users", currentUserId);
      await setDoc(userRef, updatedFields, { merge: true });
    } catch (error) {
      console.error("プロフィール保存エラー:", error);
      alert("プロフィールの保存に失敗しました。");
    }
  }
});

// ③ 掲示板：新規投稿＆もっと見る切り替え
boardPostForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = boardMessageInput.value.trim();
  if (!text) return;

  const submitBtn = boardPostForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    await addDoc(collection(db, "posts"), {
      uid: currentUserId || "guest",
      nickname: currentUserData.nickname || "ゲスト",
      avatar: AVATAR_PALETTE[currentUserData.avatar]
        ? currentUserData.avatar
        : "pink",
      text: text,
      createdAt: serverTimestamp(),
    });
    boardMessageInput.value = "";
  } catch (error) {
    console.error("掲示板投稿エラー:", error);
    alert("投稿に失敗しました。Firestoreのルール設定などを確認してください。");
  } finally {
    submitBtn.disabled = false;
  }
});

toggleBoardMoreBtn.addEventListener("click", () => {
  const isExpanded = boardList.classList.toggle("expanded");
  toggleBoardMoreBtn.textContent = isExpanded ? "閉じる ^" : "もっと見る >";
});

// =========================================
// ④ 交流スペース：地層マップエリア（上下ドラッグ＆スクロール連動）
// =========================================
const spaceMapViewport = document.getElementById("space-map-viewport");
const currentLayerIndicator = document.getElementById("current-layer-indicator");

function updateMapScrollbar() {
  if (!spaceMapViewport || !currentLayerIndicator) return;

  const viewportHeight = spaceMapViewport.clientHeight;
  const scrollHeight = spaceMapViewport.scrollHeight;
  const scrollTop = spaceMapViewport.scrollTop;
  const maxScroll = Math.max(1, scrollHeight - viewportHeight);

  // 現在表示中の地層と深度を計算してバッジに表示
  const centerPos = scrollTop + viewportHeight * 0.45;
  const depthMeters = Math.min(
    300,
    Math.max(0, Math.round((scrollTop / maxScroll) * 300)),
  );
  let layerText = "第1層（上層）";
  if (centerPos >= (scrollHeight * 2) / 3) {
    layerText = "第3層（深層）";
  } else if (centerPos >= scrollHeight / 3) {
    layerText = "第2層（中層）";
  }
  currentLayerIndicator.textContent = `${layerText}｜地下 -${depthMeters}m`;
}

if (spaceMapViewport) {
  // スクロール時に深度表示を同期
  spaceMapViewport.addEventListener("scroll", updateMapScrollbar, {
    passive: true,
  });
  window.addEventListener("resize", updateMapScrollbar);

  // マップ本体の「押したまま上下にドラッグ（Grab Scroll）」
  let isMapDragging = false;
  let mapStartY = 0;
  let mapStartScrollTop = 0;

  spaceMapViewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    isMapDragging = true;
    mapStartY = event.clientY;
    mapStartScrollTop = spaceMapViewport.scrollTop;
    spaceMapViewport.classList.add("is-dragging");
    spaceMapViewport.setPointerCapture(event.pointerId);
  });

  spaceMapViewport.addEventListener("pointermove", (event) => {
    if (!isMapDragging) return;
    const deltaY = event.clientY - mapStartY;
    spaceMapViewport.scrollTop = mapStartScrollTop - deltaY;
  });

  const stopMapDragging = (event) => {
    if (!isMapDragging) return;
    isMapDragging = false;
    spaceMapViewport.classList.remove("is-dragging");
    if (
      event?.pointerId !== undefined &&
      spaceMapViewport.hasPointerCapture?.(event.pointerId)
    ) {
      spaceMapViewport.releasePointerCapture(event.pointerId);
    }
  };

  spaceMapViewport.addEventListener("pointerup", stopMapDragging);
  spaceMapViewport.addEventListener("pointercancel", stopMapDragging);
}
