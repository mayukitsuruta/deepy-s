import { db, auth } from "./firebase.js";

import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

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

// 「ゲストとして遊ぶ」をクリック（1ブラウザ＝1ゲスト：既存データがあればそのまま復帰）
let pendingGuestDocData = null;

guestButton.addEventListener("click", async () => {
  guestButton.disabled = true;
  try {
    const user = auth.currentUser || (await signInAnonymously(auth)).user;
    currentUserId = user.uid;

    const userRef = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userRef);
    pendingGuestDocData = userSnapshot.exists() ? userSnapshot.data() : null;

    if (pendingGuestDocData && pendingGuestDocData.nickname) {
      openRegister.hidden = !user.isAnonymous;
      // オンライン状態の更新は enterHomeWithUser -> startOnlinePresence 内で非同期に行われるため待ち時間なしで入場
      enterHomeWithUser(user.uid, pendingGuestDocData);
    } else {
      showScreen(guestScreen);
    }
  } catch (error) {
    console.error("ゲストログイン確認エラー:", error);
    showScreen(guestScreen);
  } finally {
    guestButton.disabled = false;
  }
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
    // すでに匿名ログイン済みならそのまま再利用（通信を省略）
    const user = auth.currentUser || (await signInAnonymously(auth)).user;
    const userRef = doc(db, "users", user.uid);

    let userData;
    let savePromise;
    // 直前の確認結果を再利用して2回目の getDoc 通信を省略
    if (!pendingGuestDocData) {
      userData = {
        nickname: nickname,
        avatar: "pink",
        friendshipPoints: 0,
        bio: "地底でのんびり暮らしてます。よろしくお願いします！",
        tags: ["デザイン", "カフェ巡り", "音楽"],
        houseLocation: "第3層・右下エリア",
        isOnline: true,
        lastActiveMs: Date.now(),
        createdAt: serverTimestamp(),
      };
      savePromise = setDoc(userRef, userData);
    } else {
      userData = {
        ...pendingGuestDocData,
        nickname: nickname,
        isOnline: true,
        lastActiveMs: Date.now(),
      };
      savePromise = setDoc(
        userRef,
        {
          nickname: nickname,
          isOnline: true,
          lastActiveMs: Date.now(),
        },
        { merge: true },
      );
    }

    pendingGuestDocData = userData;
    openRegister.hidden = !user.isAnonymous;
    enterHomeWithUser(user.uid, userData);
    alert("地底生活へようこそ、" + nickname + "！");

    await savePromise;
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
    stopCamera();
    await sendPresenceHeartbeat(false);
    // Firebaseからログアウト
    await signOut(auth);
    currentUserId = null;
    pendingGuestDocData = null;

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

    enterHomeWithUser(user.uid, userData);

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
    enterHomeWithUser(user.uid, userData);
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
  navItems.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  if (viewName === "space") {
    homeViewContent.hidden = true;
    spaceViewContent.hidden = false;
    cameraViewContent.hidden = true;
    if (topbarTitleArea) {
      topbarTitleArea.textContent = "";
    }
    requestAnimationFrame(() => {
      updateMapScrollbar();
    });
  } else if (viewName === "camera") {
    homeViewContent.hidden = true;
    spaceViewContent.hidden = true;
    cameraViewContent.hidden = false;
    if (topbarTitleArea) topbarTitleArea.textContent = "地底の思い出を写真に残そう。";
  } else {
    homeViewContent.hidden = false;
    spaceViewContent.hidden = true;
    cameraViewContent.hidden = true;
    if (topbarTitleArea) {
      topbarTitleArea.textContent = "";
    }
  }
}

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    if (view === "home" || view === "space" || view === "camera") {
      switchUndergroundView(view);
      if (view !== "camera") stopCamera();
    } else {
      alert("この画面は現在準備中です！");
    }
  });
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
