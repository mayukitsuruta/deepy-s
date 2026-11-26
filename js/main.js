import { db, auth } from "./firebase.js?v=20261110-persistent-google";
import {
  createSpaceHousing,
  normalizeSpaceHouses,
  houseLocation,
  HOUSE_MESSAGE_LIFETIME_MS,
} from "./space-houses.js?v=20261124-house-pointer-preview";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInWithPopup,
  signInWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

function initCharacterCarousel(carousel) {
  const cards = Array.from(carousel.querySelectorAll(".character-card"));
  const status = carousel.querySelector(".carousel-status");
  const ring = carousel.querySelector(".carousel-ring");
  // Repeat the four characters around the drum so the neighbours are visible from the front.
  const step = 180 / cards.length;
  let position = 0;
  let drag = null;
  let suppressClick = false;

  cards.forEach((card, index) => {
    card.style.setProperty("--slot-angle", `${index * step}deg`);
    for (const offset of [0, 180]) {
      const back = document.createElement("div");
      back.classList.add(
        "carousel-back",
        card.querySelector(".character-button").dataset.character,
      );
      back.setAttribute("aria-hidden", "true");
      back.dataset.index = index;
      back.style.setProperty("--slot-angle", `${index * step + offset}deg`);
      ring.append(back);
    }
  });

  function rotateTo(next) {
    // Keep whole turns so the last-to-first animation continues in the same direction.
    position = next;
    const index = ((next % cards.length) + cards.length) % cards.length;
    const active = cards[index];
    carousel.style.setProperty("--carousel-rotation", `${next * step}deg`);
    active.removeAttribute("aria-hidden");
    active.setAttribute("aria-current", "true");
    if (
      carousel.querySelector(".character-card:focus-within") &&
      !active.matches(":focus-within")
    ) {
      active.querySelector(".character-button").focus({ preventScroll: true });
    }
    cards.forEach((card) => {
      if (card === active) return;
      card.setAttribute("aria-hidden", "true");
      card.removeAttribute("aria-current");
    });
    status.textContent = `${active.querySelector("h3").textContent}（${index + 1} / ${cards.length}）`;
  }

  rotateTo(0);
  carousel
    .querySelector(".carousel-prev")
    .addEventListener("click", () => rotateTo(position - 1));
  carousel
    .querySelector(".carousel-next")
    .addEventListener("click", () => rotateTo(position + 1));
  carousel.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    rotateTo(position + (event.key === "ArrowRight" ? 1 : -1));
  });

  carousel.addEventListener(
    "click",
    (event) => {
      if (suppressClick && event.detail > 0) {
        event.stopPropagation();
        event.preventDefault();
        return;
      }
      const back = event.target.closest(".carousel-back");
      const card = back
        ? cards[Number(back.dataset.index)]
        : event.target.closest(".character-card");
      if (!card) return;
      if (card.hasAttribute("aria-current")) {
        if (!back && !event.target.closest(".character-button"))
          card.querySelector(".character-button").click();
        return;
      }
      let distance = (cards.indexOf(card) - position) % cards.length;
      if (Math.abs(distance) > cards.length / 2)
        distance -= Math.sign(distance) * cards.length;
      rotateTo(position + distance);
    },
    true,
  );

  carousel.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    if (event.target.closest(".carousel-arrow")) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      distance: Math.min(carousel.clientWidth * 0.5, 280),
    };
  });

  carousel.addEventListener("pointermove", (event) => {
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    if (drag.start === undefined) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(event.clientY - drag.y))
        return;
      drag.start =
        parseFloat(
          getComputedStyle(carousel).getPropertyValue("--carousel-rotation"),
        ) / step;
      carousel.setPointerCapture(event.pointerId);
      carousel.classList.add("is-dragging");
    }
    carousel.style.setProperty(
      "--carousel-rotation",
      `${(drag.start - dx / drag.distance) * step}deg`,
    );
  });

  function finishDrag(event) {
    if (drag?.id !== event.pointerId) return;
    if (drag.start !== undefined) {
      carousel.classList.remove("is-dragging");
      suppressClick = true;
      const travel = (drag.x - event.clientX) / drag.distance;
      const flick = Math.abs(travel) >= 0.22 && Math.abs(travel) < 0.5;
      const next = flick
        ? Math.round(drag.start) + Math.sign(travel)
        : Math.round(drag.start + travel);
      rotateTo(event.type === "pointerup" ? next : position);
    }
    drag = null;
  }
  carousel.addEventListener("pointerup", finishDrag);
  carousel.addEventListener("pointercancel", finishDrag);
  carousel.addEventListener("lostpointercapture", (event) => {
    if (event.target === carousel) finishDrag(event);
  });
  carousel.addEventListener("pointerleave", (event) => {
    if (
      drag?.id === event.pointerId &&
      !carousel.hasPointerCapture(event.pointerId)
    )
      drag = null;
  });
}

console.log("DEEPY’sのFirebase接続準備ができました！");
console.log("Firestore:", db);

// 画面を取得
const firstView = document.getElementById("first-view");
const loginScreen = document.getElementById("login-screen");

// ゲスト参加画面
const guestScreen = document.getElementById("guest-screen");
const guestButton = document.getElementById("guest-button");
const backButton = document.getElementById("back-to-login");

const guestForm = document.getElementById("guest-form");
const guestName = document.getElementById("guest-name");

const homeScreen = document.getElementById("home-screen");
const homeNickname = document.getElementById("home-nickname");
const descentScreen = document.getElementById("descent-screen");
const descentMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let descentActive = false;
let descentGeneration = 0;
let descentStartedAt = 0;

function descentTimings() {
  const reduce = descentMotion.matches;
  return { hold: reduce ? 700 : 5000, leave: reduce ? 180 : 650 };
}

function setScreensInert(inert) {
  document.querySelectorAll("body > .screen").forEach((element) => {
    element.toggleAttribute("inert", inert);
  });
}

function restartDescentWorld() {
  const world = descentScreen.querySelector(".descent-world");
  if (!world) return;
  world.style.animation = "none";
  void world.offsetWidth;
  world.style.animation = "";
}

function beginDescent(fresh = false) {
  if (!descentActive || fresh) {
    descentGeneration += 1;
    descentActive = true;
    descentStartedAt = fresh
      ? Date.now()
      : descentStartedAt || window.__deepysDescentStart || Date.now();
    if (fresh) descentScreen.classList.remove("is-leaving");
  }
  document.documentElement.classList.add("is-descending");
  if (fresh) restartDescentWorld();
  descentScreen.setAttribute("aria-busy", "true");
  setScreensInert(true);
  return descentGeneration;
}

function waitForDescent() {
  const elapsed = descentStartedAt ? Date.now() - descentStartedAt : 0;
  const remain = Math.max(0, descentTimings().hold - elapsed);
  return new Promise((resolve) => {
    window.setTimeout(resolve, remain);
  });
}

function finishDescent() {
  if (!descentActive) return Promise.resolve();
  const token = descentGeneration;
  descentScreen.classList.add("is-leaving");
  setScreensInert(false);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      if (token !== descentGeneration) {
        resolve();
        return;
      }
      descentScreen.classList.remove("is-leaving");
      document.documentElement.classList.remove("is-descending");
      descentScreen.setAttribute("aria-busy", "false");
      descentActive = false;
      descentStartedAt = 0;
      resolve();
    }, descentTimings().leave);
  });
}

function cancelDescent() {
  if (
    !descentActive &&
    !document.documentElement.classList.contains("is-descending")
  )
    return;
  descentGeneration += 1;
  descentActive = false;
  descentStartedAt = 0;
  descentScreen.classList.remove("is-leaving");
  document.documentElement.classList.remove("is-descending");
  descentScreen.setAttribute("aria-busy", "false");
  setScreensInert(false);
}

function returnToTop() {
  cancelDescent();
  showScreen(firstView);
}

if (document.documentElement.classList.contains("is-descending")) {
  beginDescent();
}

const logoutButton = document.getElementById("logout-button");

const openRegister = document.getElementById("open-register");
const deleteAccountButton = document.getElementById("delete-account");
const deleteAccountModal = document.getElementById("delete-account-modal");
const confirmDeleteAccount = document.getElementById("confirm-delete-account");
const cancelDeleteAccount = document.getElementById("cancel-delete-account");
const deleteAccountMessage = document.getElementById("delete-account-message");
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

const newRegisterButton = document.getElementById("register-button");
const registerNicknameArea = document.getElementById("register-nickname-area");
const registerNickname = document.getElementById("register-nickname");

// 画面の切り替え
function showScreen(screen) {
  firstView.hidden = true;
  loginScreen.hidden = true;
  guestScreen.hidden = true;
  homeScreen.hidden = true;
  signinScreen.hidden = true;

  screen.hidden = false;
}

document.getElementById("start-game").addEventListener("click", () => {
  showScreen(loginScreen);
  document.getElementById("login-heading").focus();
});

// 「ゲストとして遊ぶ」をクリック（1ブラウザ＝1ゲスト：既存データがあればそのまま復帰）
let pendingGuestDocData = null;
const PROFILE_CACHE_KEY = "deepys-profile";
let guestUserPromise = null;
let profilePrefetch = null;
let profilePrefetchUid = null;
let sessionVersion = 0;

function readProfileCache(uid) {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(PROFILE_CACHE_KEY) || "null",
    );
    if (!parsed || parsed.uid !== uid || !parsed.data) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeProfileCache(uid, data) {
  if (!uid || !data || auth.currentUser?.isAnonymous) return;
  const plain = {};
  Object.entries(data).forEach(([key, value]) => {
    if (key === "spaceHouses") {
      plain[key] = normalizeSpaceHouses(value);
      return;
    }
    if (
      value == null ||
      ["string", "number", "boolean"].includes(typeof value)
    ) {
      plain[key] = value;
      return;
    }
    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string")
    ) {
      plain[key] = value;
    }
  });
  try {
    localStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify({ uid, data: plain }),
    );
  } catch (error) {
    console.warn("プロフィールの端末保存に失敗:", error);
  }
}

function clearAccountStorage(uid) {
  clearProfileCache();
  if (!uid) return;
  try {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith("deepys-") && key.endsWith(`:${uid}`)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // 端末の保存を消せない場合も、サーバー上のアカウントは消す
  }
}

function showAccountActions(user) {
  const registered = Boolean(user && !user.isAnonymous);
  openRegister.hidden = registered;
  deleteAccountButton.hidden = !registered;
  logoutButton.textContent = registered ? "ログアウト" : "体験を終了する";
}

function clearProfileCache() {
  try {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (
        key === PROFILE_CACHE_KEY ||
        (key.startsWith("deepys-") && key.endsWith(":local"))
      ) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // 端末に保存できない環境では次回も通信で復元する
  }
}

function savedNickname(data) {
  const nickname = String(data?.nickname || "").trim();
  return nickname;
}

async function loadAccountProfile(user) {
  const cached = readProfileCache(user.uid);
  let remote = null;
  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));
    if (snapshot.exists()) remote = snapshot.data();
  } catch (error) {
    console.warn("プロフィールの取得に失敗:", error);
  }

  const nickname =
    savedNickname(remote) ||
    String(user.displayName || "").trim() ||
    savedNickname(cached) ||
    "ゲスト";

  if (nickname !== "ゲスト" && user.displayName !== nickname) {
    updateProfile(user, { displayName: nickname }).catch(() => {});
  }

  return {
    ...createBlankUserData(),
    ...(cached || {}),
    ...(remote || {}),
    nickname,
  };
}

function prefetchProfile(user) {
  if (!user) return Promise.resolve(null);
  if (profilePrefetch && profilePrefetchUid === user.uid)
    return profilePrefetch;

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
        const remote = snapshot.data();
        const nickname =
          savedNickname(remote) ||
          savedNickname(pendingGuestDocData) ||
          savedNickname(currentUserData) ||
          "ゲスト";
        pendingGuestDocData = withSavedFriendship(
          { ...remote, nickname },
          user.uid,
        );
        if (!user.isAnonymous) writeProfileCache(user.uid, pendingGuestDocData);
      }
      if (
        pendingGuestDocData &&
        currentUserId === user.uid &&
        !homeScreen.hidden
      ) {
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

// Firebase が保存済みのログイン状態を読み終わるまで待つ。
const authReady = auth.authStateReady();

function ensureGuestUser() {
  if (auth.currentUser?.isAnonymous) return Promise.resolve(auth.currentUser);
  if (!guestUserPromise) {
    const version = sessionVersion;
    guestUserPromise = authReady
      .then(async () => {
        if (version !== sessionVersion) return auth.currentUser;
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
          await signOut(auth);
        }
        if (auth.currentUser?.isAnonymous) return auth.currentUser;
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

function rememberAndEnter(user, userData, persist = true) {
  pendingGuestDocData = userData;
  if (persist && user && !user.isAnonymous)
    writeProfileCache(user.uid, userData);
  showAccountActions(user);
  enterHomeWithUser(user.uid, userData);
}

// ログインか新規登録のあと、潜ってからホームへ入る。
async function enterAfterLogin(user, userData, persist = true) {
  if (!homeScreen.hidden && currentUserId === user.uid) {
    rememberAndEnter(user, userData, persist);
    return;
  }
  const token = beginDescent(true);
  const version = sessionVersion;
  pendingGuestDocData = userData;
  if (persist && user && !user.isAnonymous)
    writeProfileCache(user.uid, userData);
  showAccountActions(user);
  enterHomeWithUser(user.uid, userData);
  await waitForDescent();
  if (
    token !== descentGeneration ||
    version !== sessionVersion ||
    auth.currentUser?.uid !== user.uid
  ) {
    if (token === descentGeneration) cancelDescent();
    return;
  }
  await finishDescent();
}

guestButton.addEventListener("click", () => {
  sessionVersion += 1;
  // ゲストは毎回はじめに戻る。前の人の名前や進み具合は引き継がない
  guestName.value = "";
  resetPlayMemory();
  showScreen(guestScreen);
  guestName.focus();

  ensureGuestUser().catch((error) => {
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
    // ゲスト情報はアカウント登録まで保存しない
    const user = await ensureGuestUser();
    const userData = {
      nickname,
      avatar: "pink",
      friendshipPoints: 0,
      bio: "地底でのんびり暮らしてます。よろしくお願いします！",
      tags: ["デザイン", "カフェ巡り", "音楽"],
      houseLocation: "第3層・右下エリア",
      isOnline: true,
      lastActiveMs: Date.now(),
    };

    currentUserData = createBlankUserData();
    rememberAndEnter(user, userData, false);
  } catch (error) {
    console.error("ゲスト登録エラー:", error);
    alert("登録に失敗しました。コンソールを確認してね。");
  } finally {
    submitButton.disabled = false;
  }
});

logoutButton.addEventListener("click", () => {
  const confirmed = confirm(
    "ログアウトしますか？\n" +
      "ゲストのまま終了すると、進み具合は保存されません。",
  );

  if (!confirmed) return;

  stopCamera();
  const user = auth.currentUser;
  const registered = Boolean(user && !user.isAnonymous);
  const presence = registered
    ? sendPresenceHeartbeat(false)
    : Promise.resolve();
  sessionVersion += 1;
  clearProfileCache();
  resetPlayMemory();
  guestName.value = "";
  homeNickname.textContent = "ゲストさん";
  returnToTop();
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  const ending = !user
    ? Promise.resolve()
    : user.isAnonymous
      ? user.delete()
      : presence
          .catch((error) => {
            console.warn("オンライン状態の更新に失敗:", error);
          })
          .then(() => signOut(auth));

  ending.catch((error) => {
    console.error("ログアウトエラー:", error);
    return signOut(auth).catch(() => {});
  });
});

function closeDeleteAccountModal() {
  if (confirmDeleteAccount.disabled) return;
  deleteAccountModal.hidden = true;
  deleteAccountMessage.textContent = "";
}

deleteAccountButton.addEventListener("click", () => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  deleteAccountMessage.textContent = "";
  deleteAccountModal.hidden = false;
  cancelDeleteAccount.focus();
});

cancelDeleteAccount.addEventListener("click", closeDeleteAccountModal);

deleteAccountModal.addEventListener("click", (event) => {
  if (event.target === deleteAccountModal) closeDeleteAccountModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || deleteAccountModal.hidden) return;
  closeDeleteAccountModal();
});

confirmDeleteAccount.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  confirmDeleteAccount.disabled = true;
  cancelDeleteAccount.disabled = true;
  deleteAccountMessage.textContent = "消しています...";

  const uid = user.uid;
  try {
    try {
      const postsQuery = query(
        collection(db, "posts"),
        where("uid", "==", uid),
      );
      const posts = await getDocs(postsQuery);
      await Promise.all(posts.docs.map((snapshot) => deleteDoc(snapshot.ref)));
    } catch (error) {
      console.warn("投稿の削除に失敗:", error);
    }

    try {
      await deleteDoc(doc(db, "simpyRhythmScores", uid));
    } catch (error) {
      console.warn("ミニゲーム記録の削除に失敗:", error);
    }

    await deleteDoc(doc(db, "users", uid));
    clearAccountStorage(uid);
    await user.delete();

    stopCamera();
    sessionVersion += 1;
    resetPlayMemory();
    guestName.value = "";
    homeNickname.textContent = "ゲストさん";
    deleteAccountModal.hidden = true;
    deleteAccountMessage.textContent = "";
    returnToTop();
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  } catch (error) {
    console.error("アカウント削除エラー:", error);
    deleteAccountMessage.textContent =
      error.code === "auth/requires-recent-login"
        ? "もう一度ログインしてから、アカウントを消してね。"
        : "消せませんでした。もう一度試してね。";
  } finally {
    confirmDeleteAccount.disabled = false;
    cancelDeleteAccount.disabled = false;
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
    await authReady;
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

    await setDoc(
      doc(db, "users", user.uid),
      {
        ...userData,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    if (userData.nickname) {
      await updateProfile(user, { displayName: userData.nickname }).catch(
        () => {},
      );
    }

    registerModal.hidden = true;
    registerForm.reset();
    registerMessage.textContent = "";
    await enterAfterLogin(user, userData);
    touchMelodyProfile();
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

// 保存済みセッションがない場合のメールログイン。
loginButton.addEventListener("click", () => {
  signinMessage.textContent = "";
  showScreen(signinScreen);
  document.getElementById("signin-email").focus();
});

document
  .getElementById("email-login-shortcut")
  .addEventListener("click", () => loginButton.click());

// もどるボタン
signinBack.addEventListener("click", () => {
  showScreen(loginScreen);
});

// メールアドレス＋パスワードでログイン
signinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const version = ++sessionVersion;

  const email = document.getElementById("signin-email").value.trim();
  const password = document.getElementById("signin-password").value;
  const submitButton = document.getElementById("signin-submit");

  submitButton.disabled = true;
  signinMessage.textContent = "ログイン中...";

  try {
    await authReady;
    // Firebase Authenticationでログイン
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );

    const user = userCredential.user;
    guestUserPromise = null;
    profilePrefetch = null;
    profilePrefetchUid = null;
    const initial = await loadAccountProfile(user);

    if (version !== sessionVersion || auth.currentUser?.uid !== user.uid)
      return;

    signinForm.reset();
    signinMessage.textContent = "";
    await enterAfterLogin(user, initial, true);
    prefetchProfile(user);
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
const navItems = document.querySelectorAll(".home-nav button[data-view]");
const homeViewContent = document.getElementById("home-view-content");
const spaceViewContent = document.getElementById("space-view-content");
const cameraViewContent = document.getElementById("camera-view-content");
const storyViewContent = document.getElementById("story-view-content");
const simpyStoryView = document.getElementById("simpy-story-view");
const nasupyStoryView = document.getElementById("nasupy-story-view");
const hitopyStoryView = document.getElementById("hitopy-story-view");
let activeStoryId = "chippy";
let rhythmTheme = "music";
const zukanViewContent = document.getElementById("zukan-view-content");
const diagnosisViewContent = document.getElementById("diagnosis-view-content");
const zukanNote = document.getElementById("zukan-note");
const topbarTitleArea = document.getElementById("topbar-title-area");
const topbarAvatar = document.getElementById("topbar-avatar");
const onlineCountEl = document.getElementById("online-count");
const friendshipValueEl = document.getElementById("friendship-value");

// ② プロフィール
const profileAvatarDisplay = document.getElementById("profile-avatar-display");
const profileNickname = document.getElementById("profile-nickname");
const profileBio = document.getElementById("profile-bio");
const profileTags = document.getElementById("profile-tags");
const toggleProfileEditBtn = document.getElementById("toggle-profile-edit");
const profileEditForm = document.getElementById("profile-edit-form");
const profileEditFields = document.getElementById("profile-edit-fields");
const profileAvatarInput = document.getElementById("profile-avatar-input");
const profileAvatarPreview = document.getElementById("profile-avatar-preview");
const profileAvatarPresets = document.getElementById("profile-avatar-presets");
const profileAvatarModeButtons = profileEditForm.querySelectorAll(
  ".profile-avatar-actions button",
);
const profileNicknameInput = document.getElementById("profile-nickname-input");
const profileBioInput = document.getElementById("profile-bio-input");
const profileTagsInput = document.getElementById("profile-tags-input");
const profileSaveBtn = document.getElementById("profile-save");
const cancelProfileEditBtn = document.getElementById("cancel-profile-edit");
const profileEditStatus = document.getElementById("profile-edit-status");
const residentProfileDialog = document.getElementById(
  "resident-profile-dialog",
);
const residentProfileAvatar = document.getElementById(
  "resident-profile-avatar",
);
const residentProfileName = document.getElementById("resident-profile-name");
const residentProfileHouse = document.getElementById("resident-profile-house");
const residentProfileStatus = document.getElementById(
  "resident-profile-status",
);
const residentProfileBody = document.getElementById("resident-profile-body");
const residentProfileIntro = document.getElementById("resident-profile-intro");
const residentProfileBio = document.getElementById("resident-profile-bio");
const residentProfileTags = document.getElementById("resident-profile-tags");

// ③ 掲示板
const boardPostForm = document.getElementById("board-post-form");
const boardMessageInput = document.getElementById("board-message-input");
const boardList = document.getElementById("board-list");
const toggleBoardMoreBtn = document.getElementById("toggle-board-more");

const AVATAR_PRESETS = {
  pink: { label: "ピンク", color: "#f2a6b8" },
  green: { label: "グリーン", color: "#9ed18b" },
  cream: { label: "クリーム", color: "#ecd9b5" },
  purple: { label: "パープル", color: "#b89fd9" },
  orange: { label: "オレンジ", color: "#f4ad7b" },
  chippy: { label: "CHIPPY", color: "#9ed18b", src: "./images/green.png" },
  simpy: { label: "SIMPY", color: "#f2a6b8", src: "./images/pink.png" },
  nasupy: { label: "NASUPY", color: "#b89fd9", src: "./images/purple.png" },
};
const AVATAR_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_FILE_SIZE = 10 * 1024 * 1024;
const MAX_AVATAR_DATA_LENGTH = 64000;
const AVATAR_IMAGE_DATA =
  /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

function isAvatarImage(data) {
  return (
    typeof data === "string" &&
    data.length <= MAX_AVATAR_DATA_LENGTH &&
    AVATAR_IMAGE_DATA.test(data)
  );
}

function avatarPresetKey(avatarKey) {
  return typeof avatarKey === "string" &&
    Object.hasOwn(AVATAR_PRESETS, avatarKey)
    ? avatarKey
    : "pink";
}

function getAvatarSvg(color, size) {
  return `
    <svg viewBox="0 0 36 36" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="18" cy="18" r="18" fill="${color}" />
    </svg>
  `;
}

function renderAvatar(container, { avatar, avatarImage }, size) {
  const preset = AVATAR_PRESETS[avatarPresetKey(avatar)];
  const uploaded = isAvatarImage(avatarImage);
  const source = uploaded ? avatarImage : preset.src;
  if (!source) {
    container.innerHTML = getAvatarSvg(preset.color, size);
    return;
  }

  if (container.firstElementChild?.getAttribute("src") === source) return;
  const image = new Image(size, size);
  image.className = "avatar-image";
  if (!uploaded) image.classList.add("avatar-image-preset");
  image.alt = "";
  image.addEventListener(
    "error",
    () => {
      if (container.firstElementChild === image) {
        container.innerHTML = getAvatarSvg(preset.color, size);
      }
    },
    { once: true },
  );
  image.src = source;
  container.replaceChildren(image);
}

let currentUserId = null;

function createBlankUserData() {
  return {
    nickname: "ゲスト",
    avatar: "pink",
    friendshipPoints: 0,
    bio: "地底でのんびり暮らしてます。よろしくお願いします！",
    tags: ["デザイン", "カフェ巡り", "音楽"],
    houseLocation: "まだ家がありません",
    spaceHouses: [],
  };
}

function resetPlayMemory() {
  unsubscribeHouseMessages?.();
  unsubscribeHouseMessages = null;
  currentUserId = null;
  pendingGuestDocData = null;
  guestUserPromise = null;
  profilePrefetch = null;
  profilePrefetchUid = null;
  currentUserData = createBlankUserData();
  closeProfileEditForm();
  residentProfileDialog.close();
  spaceHousing.reset();
  stopMelodyPlayback();
  stopRhythmGame();
  stopMelodyRanking();
  stopNasupyGame();
}

let currentUserData = createBlankUserData();
let unsubscribeBoard = null;
let unsubscribeHouseMessages = null;
let unsubscribeOnlineUsers = null;
let heartbeatTimer = null;
let latestUsersDocs = [];
let residentProfileOwnerId = null;
let mapNeedsInitialFocus = true;

const ONLINE_TIMEOUT_MS = 90 * 1000;

// ホーム画面内のサブビュー切り替え（ホーム / 交流スペース）
function switchUndergroundView(viewName) {
  if (viewName !== "space") {
    residentProfileDialog.close();
    spaceHousing.cancel();
  }
  homeScreen.classList.toggle(
    "is-home",
    viewName === "home" || viewName === "diagnosis",
  );
  homeScreen.classList.toggle("camera-mode", viewName === "camera");
  homeScreen.classList.toggle("space-mode", viewName === "space");
  homeScreen.classList.toggle("story-mode", viewName === "story");
  navItems.forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.dataset.view === viewName ||
        (viewName === "story" && btn.dataset.view === "home"),
    );
  });

  homeViewContent.hidden = viewName !== "home";
  spaceViewContent.hidden = viewName !== "space";
  cameraViewContent.hidden = viewName !== "camera";
  const showingStory = viewName === "story";
  if (!(showingStory && activeStoryId === "simpy")) stopMelodyPlayback();
  if (!(showingStory && activeStoryId === "hitopy")) stopRhythmGame();
  if (storyViewContent) {
    storyViewContent.hidden = !(showingStory && activeStoryId === "chippy");
  }
  if (simpyStoryView) {
    simpyStoryView.hidden = !(showingStory && activeStoryId === "simpy");
  }
  if (nasupyStoryView) {
    nasupyStoryView.hidden = !(showingStory && activeStoryId === "nasupy");
  }
  if (hitopyStoryView) {
    hitopyStoryView.hidden = !(showingStory && activeStoryId === "hitopy");
  }
  if (zukanViewContent) zukanViewContent.hidden = viewName !== "zukan";
  if (diagnosisViewContent)
    diagnosisViewContent.hidden = viewName !== "diagnosis";
  if (viewName === "zukan") renderZukan();

  if (viewName === "space") {
    if (topbarTitleArea) topbarTitleArea.textContent = "";
    requestAnimationFrame(() => {
      if (mapNeedsInitialFocus) {
        focusMapOnHome();
        mapNeedsInitialFocus = false;
      }
      updateMapScrollbar();
    });
  } else if (viewName === "camera") {
    if (topbarTitleArea)
      topbarTitleArea.textContent = "地底の思い出を写真に残そう。";
  } else if (topbarTitleArea) {
    topbarTitleArea.textContent = "";
  }

  if (viewName === "home") {
    updateHitopyPortrait();
    syncFriendshipPill();
  }
}

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    if (
      view === "home" ||
      view === "space" ||
      view === "camera" ||
      view === "zukan" ||
      view === "diagnosis"
    ) {
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

function friendshipStorageKey(uid = currentUserId) {
  return `deepys-friendship:${uid || "local"}`;
}

function readStoredFriendship(uid = currentUserId) {
  if (!auth.currentUser || auth.currentUser.isAnonymous) return 0;
  try {
    const value = Number(localStorage.getItem(friendshipStorageKey(uid)));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function progressCanBeSaved() {
  return Boolean(
    currentUserId && auth.currentUser && !auth.currentUser.isAnonymous,
  );
}

function writeStoredFriendship(points, uid = currentUserId) {
  if (!progressCanBeSaved()) return;
  try {
    localStorage.setItem(friendshipStorageKey(uid), String(points));
  } catch {
    // 端末に保存できない場合も、画面上の数字は更新する
  }
}

function resolvedFriendshipPoints(points, uid = currentUserId) {
  const parsed = Number(points ?? 0);
  const safe = Number.isFinite(parsed) ? parsed : 0;
  return Math.min(100, Math.max(0, safe, readStoredFriendship(uid)));
}

function withSavedFriendship(data, uid = currentUserId) {
  return {
    ...(data || {}),
    friendshipPoints: resolvedFriendshipPoints(data?.friendshipPoints, uid),
  };
}

function storyFriendshipFloor() {
  let points = 0;
  if (isChippyStoryCleared()) points += 25;
  if (isSimpyStoryCleared()) points += 25;
  if (isNasupyStoryCleared()) points += 25;
  if (isHitopyStoryCleared()) points += 25;
  return Math.min(100, points);
}

function syncFriendshipPill() {
  const points = Math.min(
    100,
    Math.max(
      resolvedFriendshipPoints(currentUserData.friendshipPoints),
      storyFriendshipFloor(),
    ),
  );
  if (points !== readStoredFriendship()) writeStoredFriendship(points);
  currentUserData.friendshipPoints = points;
  if (friendshipValueEl) friendshipValueEl.textContent = String(points);
  if (openZukanId) renderZukan();
}

const ZUKAN_UNLOCK_POINTS = 25;
let openZukanId = null;

const zukanEntries = [
  {
    id: "deepy",
    name: "DEEPY",
    kana: "ディーピー",
    image: "./images/deepy.png",
    occupation: "地底の案内人",
    likes: "地上に関する本、文化",
    found: "地底に着いた日",
    note: "地上から来た人を、地底の暮らしへ案内する。ガイドブックをいつも持っている。",
    tool: "青いガイドブック",
    surprise: "案内の途中で、自分も知らない道を見つけることがある。",
    secret: "ガイドブックのうしろには、まだ白いページが残っている。",
  },
  {
    id: "chippy",
    name: "CHIPPY",
    kana: "チッピー",
    image: "./images/green.png",
    occupation: "土吸収員",
    likes: "きれいな鉱物。とくにクリスタル",
    found: "上層の道ぞい",
    note: "地底で家を作るために、土を除去する仕事をしている。力持ちで、まっすぐな性格。",
    tool: "土を吸い込むホース",
    surprise: "落とし物を見つけると、道作りの手を止めて探してしまう。",
    secret: "道の土にまぎれていたクリスタルは、誰かが落としたものだった。",
  },
  {
    id: "simpy",
    name: "SIMPY",
    kana: "シンピー",
    image: "./images/pink.png",
    occupation: "音の採集家",
    likes: "不思議な音、鈴、音楽、静かな場所、古い楽器",
    found: "音の多い中層",
    note: "地底に響くいろんな音を集めている。歌うことや音楽が大好き。",
    tool: "音を集めるための道具",
    surprise: "にぎやかな音だけでなく、とても静かな音も集めている。",
    secret: "集めた音を、夜になるとひとりで歌い返している。",
  },
  {
    id: "nasupy",
    name: "NASUPY",
    kana: "ナスピー",
    image: "./images/purple.png",
    occupation: "植物の医者",
    likes: "植物、激辛調理",
    found: "深層の植え込み",
    note: "地底の植物たちの健康を守るお医者さん。植物と話せる。",
    tool: "虫めがね",
    surprise: "診た植物に、ひとつずつ名前をつけてしまう。",
    secret: "植物の具合は、声の小ささでわかってしまう。",
  },
  {
    id: "hitopy",
    name: "HITOPY",
    kana: "ヒトピー",
    image: "./images/white.png",
    occupation: "建築家",
    likes: "海、海洋生物",
    found: "まだうっていない",
    note: "地底に素敵な家を建てるのが夢。みんなの暮らしをつなぐ建築家。",
    tool: "ポケットに入った道具",
    surprise: "完成した家より、まだ建っていない家の話が好き。",
  },

  {
    id: "stappy",
    name: "STAPPY",
    kana: "スタッピー",
    image: "./images/stappy.png",
    occupation: "カリスマ",
    likes: "光るもの、かわいいもの",
    personality:
      "ギャルマインド。基本的に明るくポジティブだけど、こだわりは強め。人の良いところを見つけて褒める、陽のギャル。",
    note: "地底のインフルエンサー兼デザイナー。DEEPYたちのチャームポイントになる服や、流行のアイテムを生み出している。",
    tool: "自分の作品をデコるための道具",
    surprise: "趣味で始めたデコが、人に頼まれるうちに仕事になった。",
    secret: "地底人が身に着けているアイテムは、すべてスタッピーが作っている。",
  },
  {
    id: "zarpy",
    name: "ZARPY",
    kana: "ザーピー",
    image: "./images/zarppy.png",
    occupation: "ザーファー",
    likes: "化石、ザーフボード",
    personality:
      "「楽しそう！」と思ったことに熱中するタイプ。原動力は自分の好奇心。人懐っこく、人と話すことでエネルギーがもらえる。肯定的で、まず自分から話しかける。",
    note: "DEEPYの友達。地底でできる砂のサーフィンを仕事にしている。",
    tool: "ザーフボード",
    surprise: "地底に海はまだないので、砂の上でサーフィンをしている。",
    secret:
      "地上の海を、いつか地底にも作るのが夢。小さいころからDEEPYに地上の話を聞いていて、海が地上の7割を占めると知ってから、この遊びを考えた。",
  },
];

function zukanSecretsOpen() {
  return (
    resolvedFriendshipPoints(currentUserData.friendshipPoints) >=
    ZUKAN_UNLOCK_POINTS
  );
}

function renderZukan() {
  if (!zukanNote) return;
  if (openZukanId && zukanEntries.some((entry) => entry.id === openZukanId)) {
    renderZukanFile(openZukanId);
    return;
  }
  openZukanId = null;
  renderZukanIndex();
}

function renderZukanIndex() {
  zukanNote.replaceChildren();
  const header = document.createElement("header");
  header.innerHTML = `
    <p class="field-note-kicker">調査員の記録</p>
    <h2>地底調査ノート</h2>
    <p class="field-note-lead">名前を選ぶと、その子の調査ページが開くよ。</p>
  `;
  zukanNote.append(header);

  zukanEntries.forEach((entry, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "field-entry";
    button.innerHTML = `
      <span class="field-entry-no">${String(index + 1).padStart(2, "0")}</span>
      <span class="field-thumb">${
        entry.image
          ? `<img src="${entry.image}" alt="" />`
          : `<span class="field-thumb-empty">？</span>`
      }</span>
      <span class="field-entry-copy">
        <span class="field-entry-name">${entry.name}${
          entry.kana
            ? `<span class="field-entry-kana">${entry.kana}</span>`
            : ""
        }</span>
        <span class="field-entry-meta">${
          entry.unknown ? "まだ見つけていない" : entry.occupation
        }</span>
      </span>
      <span class="field-entry-open">開く</span>
    `;
    button.addEventListener("click", () => {
      openZukanId = entry.id;
      renderZukanFile(entry.id);
      zukanNote.scrollTop = 0;
    });
    zukanNote.append(button);
  });
}

function renderZukanFile(entryId) {
  const entry = zukanEntries.find((item) => item.id === entryId);
  if (!entry || !zukanNote) return;
  const open = zukanSecretsOpen();
  zukanNote.replaceChildren();

  const back = document.createElement("button");
  back.type = "button";
  back.className = "field-back";
  back.textContent = "ノートにもどる";
  back.addEventListener("click", () => {
    openZukanId = null;
    renderZukanIndex();
  });

  const page = document.createElement("article");
  page.className = "field-file";
  if (entry.unknown) {
    page.innerHTML = `
      <div class="field-photo field-photo-empty" aria-hidden="true">？</div>
      <div>
        <p class="field-file-kicker">未発見</p>
        <h2>${entry.name}</h2>
        <p>${entry.note}</p>
      </div>
    `;
  } else {
    const facts = [
      ["職業", entry.occupation],
      ["好きなもの", entry.likes],
      ["性格", entry.personality],
      [entry.id === "deepy" ? "発見日" : "発見場所", entry.found],
    ].filter(([, value]) => value);
    const secretBlocks = [
      ["仕事道具", entry.tool],
      ["意外な一面", entry.surprise],
      ["秘密の情報", entry.secret],
    ].filter(([, value]) => value);
    const secretLabels = secretBlocks.map(([label]) => label).join("・");
    const secret = secretBlocks.length
      ? open
        ? `
        <section class="field-secret">
          <p class="field-stamp">開封済み</p>
          <h3>秘密ファイル</h3>
          ${secretBlocks
            .map(
              ([label, value]) => `
          <div class="field-secret-block">
            <p class="field-secret-label">${label}</p>
            <p>${value}</p>
          </div>`,
            )
            .join("")}
        </section>
      `
        : `
        <section class="field-secret">
          <h3>秘密ファイル</h3>
          <div class="field-sealed">
            <p class="field-stamp">未開封</p>
            <p>友情ポイントが25%になると、${secretLabels}が読めるよ。</p>
          </div>
        </section>
      `
      : "";
    page.innerHTML = `
      <div class="field-photo">
        <img src="${entry.image}" alt="${entry.name}" />
      </div>
      <div>
        <p class="field-file-kicker">調査ページ</p>
        <h2>${entry.name}</h2>
        ${entry.kana ? `<p class="field-reading">${entry.kana}</p>` : ""}
        <dl class="field-facts">
          ${facts.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("")}
        </dl>
        <p>${entry.note}</p>
        ${secret}
      </div>
    `;
  }

  zukanNote.append(back, page);
}

function isChippyStoryCleared() {
  if (currentUserData?.chippyCleared) return true;
  if (!progressCanBeSaved()) return false;
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

  currentUserData.chippyCleared = true;

  const nextPoints = Math.min(
    100,
    Math.max(
      resolvedFriendshipPoints(currentUserData.friendshipPoints) + 25,
      storyFriendshipFloor(),
    ),
  );
  renderUserData({ friendshipPoints: nextPoints, chippyCleared: true });
  syncFriendshipPill();
  updateHitopyPortrait();

  if (!progressCanBeSaved()) return;
  try {
    localStorage.setItem(chippyClearStorageKey(), "1");
  } catch {
    // 保存できない場合も、この画面の表示は更新済み
  }
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
  activeStoryId = "chippy";
  chippyShowingClear = true;
  resetChippyGame();
  chippyDialogue.hidden = true;
  chippyClearPanel.hidden = false;
  storyViewContent.classList.add("is-cleared");
  updateChippyPrev();
  switchUndergroundView("story");
}

function startChippyStory() {
  activeStoryId = "chippy";
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
  sayChippy(
    "三つのうちのひとつに、クリスタルが埋まってる。土をクリックして吸ってみて！",
    "土を吸おう",
  );
}

document
  .querySelectorAll(".character-button[data-character='chippy']")
  .forEach((button) => {
    button.addEventListener("click", openChippyStory);
  });

initCharacterCarousel(document.querySelector(".character-carousel"));

storyViewContent?.addEventListener("click", (event) => {
  if (
    event.target.closest(
      "#chippy-story-back, #chippy-story-prev, #chippy-game-start, #chippy-replay, #chippy-finish-home, .chippy-mound, .chippy-clear-panel, .chippy-finish",
    )
  ) {
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
  if (
    event.target.closest?.(
      "#chippy-story-back, #chippy-story-prev, #chippy-game-start, #chippy-replay, #chippy-finish-home, .chippy-mound",
    )
  )
    return;
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

const simpyStoryLines = [
  "中層まで来てくれたんだね。わたしはSIMPY。",
  "職業は音の採集家。地底に響く音を、このシンバルでそっと拾ってるの。",
  "鈴の音、古い楽器、だれかの歌声。にぎやかな音だけじゃなく、とても静かな音も集めてる。",
  "夜になると、集めた音をひとりで歌い返すの。今日は、あなたにも聴いてほしくて。",
  "3つの小節を、最初に正しい順番で鳴らすね。よく聴いて。",
  "そのあと小節がばらばらになるよ。クリックすると、その音だけもう一度鳴る。",
  "聴いた順番どおりに並べられたら、一曲になる。準備はいいかな。",
];

const MELODY_THEMES = [
  {
    id: "flower",
    title: "花のしらべ",
    wave: "triangle",
    gain: 0.08,
    noteDur: 0.22,
    gap: 0.05,
    measures: [
      { file: "sheet-music-flower01.png", notes: [523.25, 659.25, 783.99] },
      { file: "sheet-music-flower02.png", notes: [880, 698.46, 523.25] },
      { file: "sheet-music-flower03.png", notes: [587.33, 783.99, 659.25] },
    ],
  },
  {
    id: "fruit",
    title: "果実のしらべ",
    wave: "square",
    gain: 0.04,
    noteDur: 0.12,
    gap: 0.07,
    measures: [
      { file: "sheet-music-fruit01.png", notes: [392, 493.88, 587.33] },
      { file: "sheet-music-fruit02.png", notes: [587.33, 587.33, 349.23] },
      { file: "sheet-music-fruit03.png", notes: [440, 554.37, 659.25] },
    ],
  },
  {
    id: "jemstone",
    title: "宝石のしらべ",
    wave: "sine",
    gain: 0.06,
    noteDur: 0.26,
    gap: 0.04,
    measures: [
      {
        file: "sheet-music-jemstone01.png",
        notes: [1318.51, 1567.98, 1975.53],
      },
      { file: "sheet-music-jemstone02.png", notes: [987.77, 1174.66, 1479.98] },
      { file: "sheet-music-jemstone03.png", notes: [1567.98, 1174.66, 987.77] },
    ],
  },
  {
    id: "water",
    title: "水のしらべ",
    wave: "sine",
    gain: 0.08,
    noteDur: 0.34,
    gap: 0.06,
    measures: [
      { file: "sheet-music-water01.png", notes: [261.63, 392, 523.25] },
      { file: "sheet-music-water02.png", notes: [220, 329.63, 440] },
      { file: "sheet-music-water03.png", notes: [349.23, 440, 523.25] },
    ],
  },
];

const MELODY_SCORE_MAX = 6000;

const simpyDialogueText = document.getElementById("simpy-dialogue-text");
const simpyDialogueNext = document.getElementById("simpy-dialogue-next");
const simpyDialogue = document.getElementById("simpy-dialogue");
const simpyStoryBack = document.getElementById("simpy-story-back");
const simpyStoryPrev = document.getElementById("simpy-story-prev");
const simpyGameStart = document.getElementById("simpy-game-start");
const simpyClearPanel = document.getElementById("simpy-clear-panel");
const simpyReplay = document.getElementById("simpy-replay");
const simpyFinish = document.getElementById("simpy-finish");
const simpyFinishMessage = document.getElementById("simpy-finish-message");
const simpyFinishHome = document.getElementById("simpy-finish-home");
const melodyPlayEl = document.getElementById("melody-play");
const melodyStatusEl = document.getElementById("melody-status");
const melodyRoundEl = document.getElementById("melody-round");
const melodyStaffEl = document.getElementById("melody-staff");
const melodyListenEl = document.getElementById("melody-listen");
const melodySubmitEl = document.getElementById("melody-submit");
const melodyScoreEl = document.getElementById("rhythm-score");
const melodyBestEl = document.getElementById("rhythm-best");
const melodySaveNote = document.getElementById("rhythm-save-note");
const melodyRankingEl = document.getElementById("rhythm-ranking");
let rhythmIntroEl = document.getElementById("rhythm-intro");
let rhythmPlayEl = document.getElementById("rhythm-play");
let rhythmDoneEl = document.getElementById("rhythm-done");
let rhythmDoneText = document.getElementById("rhythm-done-text");
let rhythmLaneEl = document.getElementById("rhythm-lane");
let rhythmHitZoneEl = document.getElementById("rhythm-hit-zone");
let rhythmComboEl = document.getElementById("rhythm-combo");
let rhythmProgressEl = document.getElementById("rhythm-progress");
let rhythmPointsEl = document.getElementById("rhythm-points");
let rhythmJudgeEl = document.getElementById("rhythm-judge");
let rhythmGoodSpawn = 0;

const rhythmBuildStage = {
  theme: "build",
  intro: null,
  play: document.getElementById("hitopy-rhythm-play"),
  done: document.getElementById("hitopy-rhythm-done"),
  doneText: document.getElementById("hitopy-rhythm-done-text"),
  lane: document.getElementById("hitopy-rhythm-lane"),
  hitZone: document.getElementById("hitopy-rhythm-hit-zone"),
  combo: document.getElementById("hitopy-rhythm-combo"),
  progress: document.getElementById("hitopy-rhythm-progress"),
  points: document.getElementById("hitopy-rhythm-points"),
  judge: document.getElementById("hitopy-rhythm-judge"),
};

function bindRhythmStage(stage) {
  rhythmTheme = stage.theme;
  rhythmIntroEl = stage.intro;
  rhythmPlayEl = stage.play;
  rhythmDoneEl = stage.done;
  rhythmDoneText = stage.doneText;
  rhythmLaneEl = stage.lane;
  rhythmHitZoneEl = stage.hitZone;
  rhythmComboEl = stage.combo;
  rhythmProgressEl = stage.progress;
  rhythmPointsEl = stage.points;
  rhythmJudgeEl = stage.judge;
}

let simpyStoryIndex = 0;
let simpyShowingClear = false;
let simpyMelodyPlaying = false;
let simpyAudio = null;
let melodyVoices = [];
let melodyToken = 0;
let melodyWaiters = [];
let melodyPhase = "idle";
let melodyQueue = [];
let melodyRound = 0;
let melodyTarget = [];
let melodyOrder = [];
let melodyRevealed = false;
let melodyPlaying = false;
let melodyAwaitingNext = false;
let melodyReplays = 0;
let melodyWrongs = 0;
let roundStartedAt = 0;
let melodySessionScore = 0;
let melodyCloudBest = 0;
let melodyRanking = [];
let melodyRankError = "";
let suppressMelodyClick = false;

function simpyClearStorageKey() {
  return `deepys-simpy-cleared:${currentUserId || "local"}`;
}

function melodyBestStorageKey() {
  return `deepys-melody-best:${currentUserId || "local"}`;
}

function readMelodyLocalBest() {
  if (!currentUserId) return 0;
  try {
    const value = Number(localStorage.getItem(melodyBestStorageKey()));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function storedMelodyBest() {
  return Math.max(melodyCloudBest, readMelodyLocalBest());
}

function isSimpyStoryCleared() {
  if (currentUserData?.simpyCleared) return true;
  if (!progressCanBeSaved()) return false;
  try {
    return localStorage.getItem(simpyClearStorageKey()) === "1";
  } catch {
    return false;
  }
}

function updateSimpyPrev() {
  if (!simpyStoryPrev) return;
  simpyStoryPrev.hidden = simpyShowingClear || simpyMelodyPlaying;
  simpyStoryPrev.disabled = simpyStoryIndex <= 0;
}

function resetStoryMelodyPanel() {
  silenceMelody();
  simpyMelodyPlaying = false;
  melodyPhase = "idle";
  melodyTarget = [];
  if (melodyPlayEl) melodyPlayEl.hidden = true;
  if (simpyFinish) simpyFinish.hidden = true;
  simpyStoryView?.classList.remove("is-playing");
}

function renderSimpyStory() {
  const isLast = simpyStoryIndex >= simpyStoryLines.length - 1;
  const showStart = isLast && !simpyMelodyPlaying;
  simpyDialogueText.textContent = simpyStoryLines[simpyStoryIndex];
  simpyGameStart.hidden = !showStart;
  simpyGameStart.textContent = "ゲームスタート";
  simpyDialogueNext.hidden = showStart;
  simpyDialogueNext.textContent = "click";
  simpyDialogueNext.classList.toggle("is-more", !isLast && !showStart);
  updateSimpyPrev();
}

function startSimpyStory() {
  activeStoryId = "simpy";
  simpyStoryIndex = 0;
  simpyShowingClear = false;
  resetStoryMelodyPanel();
  if (simpyDialogue) simpyDialogue.hidden = false;
  if (simpyClearPanel) simpyClearPanel.hidden = true;
  simpyStoryView?.classList.remove("is-cleared");
  renderSimpyStory();
  switchUndergroundView("story");
}

function showSimpyClearScreen() {
  activeStoryId = "simpy";
  simpyShowingClear = true;
  resetStoryMelodyPanel();
  if (simpyDialogue) simpyDialogue.hidden = true;
  if (simpyClearPanel) simpyClearPanel.hidden = false;
  simpyStoryView?.classList.add("is-cleared");
  updateSimpyPrev();
  switchUndergroundView("story");
}

function openSimpyStory() {
  if (isSimpyStoryCleared()) {
    showSimpyClearScreen();
    return;
  }
  startSimpyStory();
}

function advanceSimpyStory() {
  if (simpyShowingClear || simpyMelodyPlaying) return;
  if (simpyFinish && !simpyFinish.hidden) return;
  if (simpyStoryIndex >= simpyStoryLines.length - 1) return;
  simpyStoryIndex += 1;
  renderSimpyStory();
}

function rewindSimpyStory() {
  if (simpyShowingClear || simpyMelodyPlaying) return;
  if (simpyStoryIndex <= 0) return;
  simpyStoryIndex -= 1;
  renderSimpyStory();
}

function awardSimpyFriendship() {
  const already = isSimpyStoryCleared();
  if (!already) currentUserData.simpyCleared = true;

  const nextPoints = already
    ? Math.max(
        resolvedFriendshipPoints(currentUserData.friendshipPoints),
        storyFriendshipFloor(),
      )
    : Math.min(
        100,
        Math.max(
          resolvedFriendshipPoints(currentUserData.friendshipPoints) + 25,
          storyFriendshipFloor(),
        ),
      );

  renderUserData({ friendshipPoints: nextPoints, simpyCleared: true });
  syncFriendshipPill();

  if (!already && progressCanBeSaved()) {
    try {
      localStorage.setItem(simpyClearStorageKey(), "1");
    } catch {
      // 保存できない場合も、この画面の表示は更新済み
    }
    writeProfileCache(currentUserId, currentUserData);
    setDoc(
      doc(db, "users", currentUserId),
      { friendshipPoints: nextPoints, simpyCleared: true },
      { merge: true },
    ).catch((error) => {
      console.error("友情ポイントの保存エラー:", error);
    });
  }

  return { already, points: nextPoints };
}

function simpyAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!simpyAudio) simpyAudio = new AudioCtx();
  if (simpyAudio.state === "suspended") simpyAudio.resume();
  return simpyAudio;
}

function simpyTone(freq, when, duration, gainValue, type) {
  const ctx = simpyAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(gainValue, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.03);
  melodyVoices.push({ osc, gain });
}

function stopMelodyVoices() {
  const now = simpyAudio ? simpyAudio.currentTime : 0;
  melodyVoices.forEach(({ osc, gain }) => {
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.0001, now);
      osc.stop(now + 0.03);
    } catch {
      // 鳴り終わった音はそのまま
    }
  });
  melodyVoices = [];
}

function silenceMelody() {
  melodyToken += 1;
  melodyWaiters.forEach(({ timer, resolve }) => {
    clearTimeout(timer);
    resolve(false);
  });
  melodyWaiters = [];
  stopMelodyVoices();
  melodyPlaying = false;
  markPlaying("");
}

function stopMelodyPlayback() {
  const wasPlaying = melodyPlaying;
  silenceMelody();
  if (
    wasPlaying &&
    melodyStatusEl &&
    melodyPhase !== "idle" &&
    melodyPhase !== "done"
  ) {
    melodyStatusEl.textContent = melodyRevealed
      ? "音を止めたよ。もう一度聴けるよ。"
      : "音を止めたよ。はじめの音を聴くを押してね。";
  }
  updateMelodyControls();
}

function waitMelody(ms, token) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      melodyWaiters = melodyWaiters.filter((item) => item.timer !== timer);
      resolve(token === melodyToken);
    }, ms);
    melodyWaiters.push({ timer, resolve, token });
  });
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function buildMeasures(theme) {
  return theme.measures.map((measure, index) => ({
    id: `${theme.id}-${index + 1}`,
    image: `./images/melody/${measure.file}`,
    notes: measure.notes,
    wave: theme.wave,
    gain: theme.gain,
    noteDur: theme.noteDur,
    gap: theme.gap,
    title: theme.title,
  }));
}

function shuffledDifferent(list) {
  let next = shuffle(list);
  let guard = 0;
  while (next.every((item, index) => item.id === list[index].id) && guard < 6) {
    next = shuffle(list);
    guard += 1;
  }
  if (
    next.every((item, index) => item.id === list[index].id) &&
    list.length > 1
  ) {
    next = [list[1], list[0], ...list.slice(2)];
  }
  return next;
}

function scheduleMeasure(measure, when) {
  let cursor = when;
  measure.notes.forEach((freq) => {
    simpyTone(freq, cursor, measure.noteDur, measure.gain, measure.wave);
    cursor += measure.noteDur + measure.gap;
  });
  return cursor;
}

function renderListenGhosts(activeIndex) {
  if (!melodyStaffEl) return;
  melodyStaffEl.replaceChildren();
  for (let index = 0; index < 3; index += 1) {
    const ghost = document.createElement("div");
    ghost.className = "melody-ghost";
    if (index === activeIndex) ghost.classList.add("is-active");
    const number = document.createElement("span");
    number.textContent = String(index + 1);
    const label = document.createElement("small");
    label.textContent = "小節目";
    ghost.append(number, label);
    melodyStaffEl.append(ghost);
  }
}

function markPlaying(id) {
  if (!melodyStaffEl) return;
  melodyStaffEl.querySelectorAll(".melody-card").forEach((card) => {
    card.classList.toggle("is-playing", Boolean(id) && card.dataset.id === id);
  });
}

function renderMelodyCards() {
  if (!melodyStaffEl) return;
  melodyStaffEl.replaceChildren();
  melodyOrder.forEach((measure, index) => {
    const card = document.createElement("article");
    card.className = "melody-card";
    card.draggable = !melodyAwaitingNext;
    card.dataset.id = measure.id;

    const slot = document.createElement("p");
    slot.className = "melody-slot-no";
    slot.textContent = `${index + 1}番目`;

    const art = document.createElement("div");
    art.className = "melody-art";
    const image = document.createElement("img");
    image.src = measure.image;
    image.alt = "";
    image.draggable = false;
    art.append(image);

    const tools = document.createElement("div");
    tools.className = "melody-card-tools";

    const left = document.createElement("button");
    left.type = "button";
    left.dataset.move = "-1";
    left.textContent = "前";
    left.setAttribute("aria-label", "前の位置へ動かす");
    left.disabled = index === 0 || melodyAwaitingNext;

    const play = document.createElement("button");
    play.type = "button";
    play.dataset.play = measure.id;
    play.textContent = "聴く";
    play.setAttribute("aria-label", `${index + 1}番目の小節を聴く`);

    const right = document.createElement("button");
    right.type = "button";
    right.dataset.move = "1";
    right.textContent = "次";
    right.setAttribute("aria-label", "次の位置へ動かす");
    right.disabled = index === melodyOrder.length - 1 || melodyAwaitingNext;

    tools.append(left, play, right);
    card.append(slot, art, tools);

    const move = (direction) => {
      moveMeasure(measure.id, direction);
    };
    left.addEventListener("click", (event) => {
      event.stopPropagation();
      move(-1);
    });
    right.addEventListener("click", (event) => {
      event.stopPropagation();
      move(1);
    });
    play.addEventListener("click", (event) => {
      event.stopPropagation();
      previewMeasure(measure);
    });
    card.addEventListener("click", () => {
      if (suppressMelodyClick) {
        suppressMelodyClick = false;
        return;
      }
      previewMeasure(measure);
    });
    card.addEventListener("dragstart", (event) => {
      if (melodyAwaitingNext || event.target.closest("button")) {
        event.preventDefault();
        return;
      }
      suppressMelodyClick = false;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", measure.id);
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", () => {
      suppressMelodyClick = true;
      card.classList.remove("is-dragging");
      setTimeout(() => {
        suppressMelodyClick = false;
      }, 80);
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      card.classList.add("is-over");
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("is-over");
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("is-over");
      const fromId = event.dataTransfer.getData("text/plain");
      swapMeasures(fromId, measure.id);
    });

    melodyStaffEl.append(card);
  });
}

function moveMeasure(id, direction) {
  if (melodyAwaitingNext || melodyPhase !== "sort") return;
  const index = melodyOrder.findIndex((item) => item.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= melodyOrder.length) return;
  const next = [...melodyOrder];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  melodyOrder = next;
  renderMelodyCards();
}

function swapMeasures(fromId, toId) {
  if (!fromId || fromId === toId || melodyAwaitingNext) return;
  const fromIndex = melodyOrder.findIndex((item) => item.id === fromId);
  const toIndex = melodyOrder.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0) return;
  const next = [...melodyOrder];
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
  melodyOrder = next;
  renderMelodyCards();
}

function updateMelodyControls() {
  if (!melodyListenEl || !melodySubmitEl) return;
  const sorting = melodyPhase === "sort" && melodyRevealed;
  melodyListenEl.disabled = melodyPlaying || melodyPhase === "done";
  melodyListenEl.textContent = melodyRevealed
    ? "もう一度聴く"
    : "はじめの音を聴く";
  melodySubmitEl.disabled = !sorting || melodyPlaying;
}

function renderMelodyScore() {
  if (melodyScoreEl) melodyScoreEl.textContent = String(melodySessionScore);
  if (melodyBestEl) {
    const best = storedMelodyBest();
    melodyBestEl.textContent = best > 0 ? String(best) : "—";
  }
}

async function playTargetSequence({ replay }) {
  silenceMelody();
  const token = melodyToken;
  melodyPlaying = true;
  melodyPhase = "listen";
  updateMelodyControls();
  const ctx = simpyAudioContext();
  if (ctx?.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // 再生できないときは、聴くボタンからもう一度試せる
    }
  }
  if (token !== melodyToken) return;
  if (!ctx) {
    melodyPlaying = false;
    if (melodyStatusEl)
      melodyStatusEl.textContent = "このブラウザでは音を鳴らせないよ。";
    updateMelodyControls();
    return;
  }

  if (!melodyRevealed) renderListenGhosts(-1);
  if (melodyStatusEl) melodyStatusEl.textContent = "聴いてね。";
  const start = ctx.currentTime + 0.08;
  let cursor = start;
  const marks = melodyTarget.map((measure, index) => {
    const at = cursor;
    cursor = scheduleMeasure(measure, at);
    cursor += 0.42;
    return { index, at };
  });
  marks.forEach((mark) => {
    const timer = setTimeout(
      () => {
        if (token !== melodyToken) return;
        if (melodyStatusEl)
          melodyStatusEl.textContent = `聴いてね。${mark.index + 1}小節目`;
        if (!melodyRevealed) renderListenGhosts(mark.index);
      },
      Math.max(0, (mark.at - ctx.currentTime) * 1000),
    );
    melodyWaiters.push({
      timer,
      resolve: () => {},
      token,
    });
  });

  const alive = await waitMelody(
    Math.max(300, (cursor - ctx.currentTime) * 1000),
    token,
  );
  if (!alive || token !== melodyToken) return;
  melodyPlaying = false;
  if (replay && melodyRevealed) melodyReplays += 1;
  if (!melodyRevealed) {
    melodyRevealed = true;
    melodyOrder = shuffledDifferent(melodyTarget);
    roundStartedAt = Date.now();
  }
  melodyPhase = "sort";
  if (melodyStatusEl) {
    melodyStatusEl.textContent =
      "小節を聴いて、最初の並びと同じになるように入れ替えてね。";
  }
  renderMelodyCards();
  updateMelodyControls();
  renderMelodyScore();
}

function previewMeasure(measure) {
  if (melodyPhase !== "sort" || melodyPlaying) return;
  silenceMelody();
  const token = melodyToken;
  const ctx = simpyAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  melodyPlaying = true;
  markPlaying(measure.id);
  updateMelodyControls();
  const end = scheduleMeasure(measure, ctx.currentTime + 0.04);
  waitMelody(Math.max(180, (end - ctx.currentTime) * 1000), token).then(
    (alive) => {
      if (!alive) return;
      melodyPlaying = false;
      markPlaying("");
      updateMelodyControls();
    },
  );
}

function beginRound() {
  const theme = melodyQueue[melodyRound];
  melodyTarget = shuffle(buildMeasures(theme));
  melodyOrder = [];
  melodyRevealed = false;
  melodyAwaitingNext = false;
  melodyReplays = 0;
  melodyWrongs = 0;
  roundStartedAt = 0;
  if (melodyRoundEl) melodyRoundEl.textContent = theme.title;
  playTargetSequence({ replay: false });
}

function startMelodySession() {
  melodyQueue = shuffle(MELODY_THEMES);
  melodyRound = 0;
  melodySessionScore = 0;
  melodyPhase = "listen";
  if (melodyIntroEl) melodyIntroEl.hidden = true;
  if (melodyDoneEl) melodyDoneEl.hidden = true;
  if (melodyPlayEl) melodyPlayEl.hidden = false;
  if (melodySaveNote) melodySaveNote.textContent = "";
  renderMelodyScore();
  beginRound();
}

function scoreCurrentRound() {
  const elapsed = roundStartedAt ? (Date.now() - roundStartedAt) / 1000 : 60;
  const timeBonus = Math.max(0, 480 - Math.floor(elapsed * 8));
  return Math.max(
    120,
    1000 + timeBonus - melodyReplays * 70 - melodyWrongs * 160,
  );
}

function submitMelodyOrder() {
  if (
    melodyPhase !== "sort" ||
    !melodyRevealed ||
    melodyPlaying ||
    melodyAwaitingNext
  )
    return;
  const correct = melodyOrder.every(
    (item, index) => item.id === melodyTarget[index].id,
  );
  if (!correct) {
    melodyWrongs += 1;
    melodyStaffEl?.classList.remove("is-wrong");
    void melodyStaffEl?.offsetWidth;
    melodyStaffEl?.classList.add("is-wrong");
    if (melodyStatusEl) {
      melodyStatusEl.textContent =
        "まだ順番が違うよ。もう一度、音を聴きくらべてみて。";
    }
    return;
  }

  completeStoryMelody();
}

function startStoryMelodyGame() {
  simpyAudioContext();
  simpyMelodyPlaying = true;
  if (simpyDialogue) simpyDialogue.hidden = true;
  if (simpyFinish) simpyFinish.hidden = true;
  if (simpyClearPanel) simpyClearPanel.hidden = true;
  simpyStoryView?.classList.add("is-playing");
  simpyStoryView?.classList.remove("is-cleared");
  melodyQueue = [
    MELODY_THEMES[Math.floor(Math.random() * MELODY_THEMES.length)],
  ];
  melodyRound = 0;
  if (melodyPlayEl) melodyPlayEl.hidden = false;
  updateSimpyPrev();
  beginRound();
}

function completeStoryMelody() {
  const result = awardSimpyFriendship();
  silenceMelody();
  simpyMelodyPlaying = false;
  melodyPhase = "done";
  if (melodyPlayEl) melodyPlayEl.hidden = true;
  simpyStoryView?.classList.remove("is-playing");
  if (simpyDialogue) simpyDialogue.hidden = true;
  if (simpyFinishMessage) {
    simpyFinishMessage.textContent = result.already
      ? "また、聴いた順番に並べられたね。"
      : `一曲になったよ。友情ポイントを25%あげるね。ホームの右上は、いま${result.points}%だよ。`;
  }
  if (simpyFinish) simpyFinish.hidden = false;
  simpyFinishHome?.focus();
}

function advanceMelodyRound() {
  if (!melodyAwaitingNext) return;
  if (melodyRound >= melodyQueue.length - 1) {
    finishMelodySession();
    return;
  }
  melodyRound += 1;
  beginRound();
}

function finishMelodySession() {
  silenceMelody();
  const previous = storedMelodyBest();
  const score = melodySessionScore;
  melodyPhase = "done";
  if (melodyPlayEl) melodyPlayEl.hidden = true;
  if (melodyDoneEl) melodyDoneEl.hidden = false;
  if (melodyDoneText) {
    melodyDoneText.textContent =
      score > previous
        ? `4曲で ${score}点。自己ベストだよ。`
        : `4曲で ${score}点。自己ベストは ${previous}点。`;
  }
  saveMelodyBest(score);
}

async function loadOwnMelodyBest() {
  renderMelodyScore();
  if (!currentUserId || !auth.currentUser) return;
  try {
    const snap = await getDoc(doc(db, "users", currentUserId));
    if (snap.exists()) {
      const remote = Number(snap.data().rhythmBest) || 0;
      melodyCloudBest = Math.max(melodyCloudBest, remote);
    }
  } catch (error) {
    console.warn("自己ベストの取得に失敗:", error);
  }
  renderMelodyScore();
}

async function saveMelodyBest(score) {
  const safeScore = Math.max(0, Math.min(MELODY_SCORE_MAX, Math.round(score)));
  const previous = storedMelodyBest();
  const best = Math.max(previous, safeScore);
  if (currentUserId) {
    try {
      localStorage.setItem(melodyBestStorageKey(), String(best));
    } catch {
      // 端末に残せなくても、画面の点数は見える
    }
  }
  renderMelodyScore();
  if (!currentUserId || !auth.currentUser) {
    if (melodySaveNote)
      melodySaveNote.textContent = "ログインすると、みんなの記録に残るよ。";
    return;
  }
  if (safeScore < previous) {
    if (melodySaveNote)
      melodySaveNote.textContent = `自己ベストは${previous}点のまま。`;
    return;
  }
  try {
    await setDoc(
      doc(db, "users", currentUserId),
      {
        nickname: currentUserData.nickname || "ゲスト",
        rhythmBest: best,
      },
      { merge: true },
    );
    melodyCloudBest = best;
    currentUserData.rhythmBest = best;
    if (melodySaveNote) melodySaveNote.textContent = "みんなの記録に残したよ。";
    renderMelodyScore();
    publishRhythmRanking();
  } catch (error) {
    console.error("ミニゲーム記録の保存エラー:", error);
    if (melodySaveNote) {
      melodySaveNote.textContent =
        "記録をサーバーに残せず、この端末にだけ覚えたよ。";
    }
  }
}

async function touchMelodyProfile() {
  if (!currentUserId || !auth.currentUser || !storedMelodyBest()) return;
  try {
    await setDoc(
      doc(db, "users", currentUserId),
      {
        nickname: currentUserData.nickname || "ゲスト",
        rhythmBest: storedMelodyBest(),
      },
      { merge: true },
    );
    publishRhythmRanking();
  } catch (error) {
    console.warn("ランキングの名前更新に失敗:", error);
  }
}

function renderMelodyRanking() {
  if (!melodyRankingEl) return;
  melodyRankingEl.replaceChildren();
  if (melodyRankError) {
    const item = document.createElement("li");
    item.className = "melody-rank-empty";
    item.textContent = melodyRankError;
    melodyRankingEl.append(item);
    return;
  }
  if (!melodyRanking.length) {
    const item = document.createElement("li");
    item.className = "melody-rank-empty";
    item.textContent = "まだ記録がないよ。";
    melodyRankingEl.append(item);
    return;
  }
  melodyRanking.forEach((row, index) => {
    const item = document.createElement("li");
    if (row.uid && row.uid === currentUserId) item.classList.add("is-me");
    const name = document.createElement("span");
    name.className = "melody-rank-name";
    name.textContent = `${index + 1}. ${row.nickname || "ゲスト"}`;
    const score = document.createElement("strong");
    score.textContent = `${Number(row.bestScore) || 0}点`;
    item.append(name, score);
    melodyRankingEl.append(item);
  });
}

function publishRhythmRanking() {
  melodyRankError = "";
  melodyRanking = latestUsersDocs
    .map((data) => ({
      uid: data.id,
      nickname: data.nickname,
      bestScore: Number(data.rhythmBest),
    }))
    .filter((row) => Number.isFinite(row.bestScore) && row.bestScore > 0)
    .sort(
      (a, b) =>
        b.bestScore - a.bestScore ||
        String(a.nickname || "").localeCompare(String(b.nickname || ""), "ja"),
    )
    .slice(0, 8);
  renderMelodyRanking();
}

function startMelodyRanking() {
  if (!unsubscribeOnlineUsers) startOnlinePresence();
  publishRhythmRanking();
}

function stopMelodyRanking() {
  melodyRanking = [];
  melodyRankError = "";
}

function showMelodyIntro() {
  melodyPhase = "idle";
  melodySessionScore = 0;
  if (melodyIntroEl) melodyIntroEl.hidden = false;
  if (melodyPlayEl) melodyPlayEl.hidden = true;
  if (melodyDoneEl) melodyDoneEl.hidden = true;
  if (melodyStatusEl) melodyStatusEl.textContent = "";
  renderMelodyScore();
}

function openMelodyMinigame() {
  startMelodyRanking();
  loadOwnMelodyBest();
  if (melodyPhase === "idle") showMelodyIntro();
  else updateMelodyControls();
}

document
  .querySelectorAll(".character-button[data-character='simpy']")
  .forEach((button) => {
    button.addEventListener("click", openSimpyStory);
  });

simpyStoryView?.addEventListener("click", (event) => {
  if (
    event.target.closest(
      "#simpy-story-back, #simpy-story-prev, #simpy-game-start, #simpy-replay, .simpy-clear-panel, #melody-play, #simpy-finish",
    )
  ) {
    return;
  }
  advanceSimpyStory();
});

simpyStoryBack?.addEventListener("click", () => {
  switchUndergroundView("home");
});

simpyStoryPrev?.addEventListener("click", (event) => {
  event.stopPropagation();
  rewindSimpyStory();
});

simpyGameStart?.addEventListener("click", (event) => {
  event.stopPropagation();
  startStoryMelodyGame();
});

simpyReplay?.addEventListener("click", (event) => {
  event.stopPropagation();
  startSimpyStory();
});

document.addEventListener("keydown", (event) => {
  if (!simpyStoryView || simpyStoryView.hidden) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  if (
    event.target.closest?.(
      "#simpy-story-back, #simpy-story-prev, #simpy-game-start, #simpy-replay, #melody-play, #simpy-finish",
    )
  ) {
    return;
  }
  event.preventDefault();
  if (simpyFinish && !simpyFinish.hidden) {
    switchUndergroundView("home");
    return;
  }
  if (simpyGameStart && !simpyGameStart.hidden) {
    startStoryMelodyGame();
    return;
  }
  advanceSimpyStory();
});

melodyListenEl?.addEventListener("click", () => {
  if (melodyPlaying || !melodyTarget.length) return;
  playTargetSequence({ replay: melodyRevealed });
});
melodySubmitEl?.addEventListener("click", submitMelodyOrder);
simpyFinishHome?.addEventListener("click", (event) => {
  event.stopPropagation();
  switchUndergroundView("home");
});

const RHYTHM_SONG = [
  523.25, 587.33, 659.25, 698.46, 783.99, 698.46, 659.25, 523.25,
];
const RHYTHM_CHART = [
  { good: true, lane: 1 },
  { good: true, lane: 0 },
  { good: false, lane: 2 },
  { good: true, lane: 2 },
  { good: true, lane: 1 },
  { good: false, lane: 0 },
  { good: true, lane: 0 },
  { good: true, lane: 2 },
  { good: false, lane: 1 },
  { good: true, lane: 1 },
  { good: true, lane: 0 },
];
const RHYTHM_FALL_MS = 2600;
const RHYTHM_GAP_MS = 1150;
const RHYTHM_LANE_LEFT = ["20%", "50%", "80%"];

let rhythmPhase = "idle";
let rhythmNotes = [];
let rhythmRaf = 0;
let rhythmLastFrame = 0;
let rhythmElapsed = 0;
let rhythmSpawnIndex = 0;
let rhythmCollected = 0;
let rhythmCombo = 0;
let rhythmPoints = 0;
let rhythmLayers = [];
let rhythmSettled = false;

function renderRhythmHud() {
  if (rhythmComboEl) rhythmComboEl.textContent = `COMBO ${rhythmCombo}`;
  if (rhythmProgressEl)
    rhythmProgressEl.textContent = `${rhythmCollected} / ${RHYTHM_SONG.length}`;
  if (rhythmPointsEl) rhythmPointsEl.textContent = `${rhythmPoints}点`;
  rhythmComboEl?.classList.toggle("is-hot", rhythmCombo >= 2);
  if (rhythmTheme !== "music") return;
  melodySessionScore = rhythmPoints;
  renderMelodyScore();
}

function flashRhythmJudge(text) {
  if (!rhythmJudgeEl) return;
  rhythmJudgeEl.textContent = text;
  rhythmJudgeEl.classList.remove("is-pop");
  void rhythmJudgeEl.offsetWidth;
  rhythmJudgeEl.classList.add("is-pop");
}

function playBuildStrike(index, when) {
  const ctx = simpyAudioContext();
  if (!ctx) return;
  const start = when ?? ctx.currentTime;
  const kind = index % 3;
  if (kind === 0) {
    simpyTone(196, start, 0.09, 0.22, "triangle");
    simpyTone(392, start, 0.05, 0.08, "square");
    return;
  }
  if (kind === 1) {
    simpyTone(880, start, 0.16, 0.12, "triangle");
    simpyTone(1320, start, 0.12, 0.05, "sine");
    return;
  }
  simpyTone(82, start, 0.32, 0.28, "sine");
  simpyTone(55, start, 0.28, 0.16, "triangle");
}

function playBuildPhrase() {
  const ctx = simpyAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let index = 0; index < RHYTHM_SONG.length; index += 1) {
    playBuildStrike(index, now + index * 0.28);
  }
}

function playRhythmSuccess(index) {
  const ctx = simpyAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const freq = RHYTHM_SONG[Math.min(index, RHYTHM_SONG.length - 1)];
  simpyTone(freq, now, 0.62, 0.1, "triangle");
  rhythmLayers.forEach((layer) => {
    simpyTone(layer, now, 0.48, 0.032, "sine");
  });
  rhythmLayers.push(freq);
}

function playRhythmWeird() {
  const ctx = simpyAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  simpyTone(146, now, 0.22, 0.06, "sawtooth");
  simpyTone(155, now + 0.03, 0.18, 0.04, "square");
}

function playRhythmSong() {
  if (rhythmTheme === "build") {
    playBuildPhrase();
    return;
  }
  const ctx = simpyAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  RHYTHM_SONG.forEach((freq, index) => {
    const start = now + index * 0.28;
    simpyTone(freq, start, 0.5, 0.1, "triangle");
    if (index > 0) simpyTone(RHYTHM_SONG[index - 1], start, 0.34, 0.04, "sine");
  });
}

function clearRhythmNotes() {
  rhythmNotes.forEach((note) => note.el.remove());
  rhythmNotes = [];
}

function stopRhythmGame() {
  if (rhythmRaf) cancelAnimationFrame(rhythmRaf);
  rhythmRaf = 0;
  clearRhythmNotes();
  const interruptPlay = rhythmPhase === "play";
  const stopSound = rhythmPhase === "play" || rhythmPhase === "done";
  if (interruptPlay) {
    rhythmPhase = "idle";
    if (rhythmPlayEl) rhythmPlayEl.hidden = true;
    if (rhythmDoneEl) rhythmDoneEl.hidden = true;
    if (rhythmIntroEl) rhythmIntroEl.hidden = rhythmTheme !== "music";
  }
  if (stopSound) silenceMelody();
}

function noteInRhythmZone(noteEl) {
  if (!rhythmHitZoneEl) return false;
  const noteBox = noteEl.getBoundingClientRect();
  const zoneBox = rhythmHitZoneEl.getBoundingClientRect();
  const center = noteBox.top + noteBox.height / 2;
  return center >= zoneBox.top - 30 && center <= zoneBox.bottom + 16;
}

function removeRhythmNote(note) {
  note.done = true;
  note.el.remove();
  rhythmNotes = rhythmNotes.filter((item) => item !== note);
}

function breakRhythmCombo() {
  rhythmCombo = 0;
  rhythmLayers = [];
  renderRhythmHud();
}

function resolveRhythmNote(note, result) {
  if (note.done || rhythmSettled) return;
  removeRhythmNote(note);
  if (result === "hit") {
    if (rhythmTheme === "build") playBuildStrike(note.soundIndex || 0);
    else playRhythmSuccess(rhythmCollected);
    const buildName = ["トン", "カン", "ドン"][(note.soundIndex || 0) % 3];
    rhythmCollected += 1;
    rhythmCombo += 1;
    rhythmPoints += 100 + (rhythmCombo - 1) * 20;
    flashRhythmJudge(
      rhythmCombo >= 2
        ? `${rhythmCombo} COMBO`
        : rhythmTheme === "build"
          ? `${buildName}！`
          : "いい音！",
    );
    renderRhythmHud();
    return;
  }
  if (result === "bad") {
    playRhythmWeird();
    breakRhythmCombo();
    rhythmPoints = Math.max(0, rhythmPoints - 50);
    flashRhythmJudge(rhythmTheme === "build" ? "崩れちゃった" : "−50");
    renderRhythmHud();
    return;
  }
  breakRhythmCombo();
  flashRhythmJudge(result === "early" ? "はやい" : "ミス");
  renderRhythmHud();
}

function spawnRhythmNote(spec) {
  if (!rhythmLaneEl) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = spec.good ? "rhythm-note is-good" : "rhythm-note is-bad";
  button.style.left = RHYTHM_LANE_LEFT[spec.lane];
  const soundIndex = rhythmGoodSpawn;
  const buildName = ["トン", "カン", "ドン"][soundIndex % 3];
  if (spec.good && rhythmTheme === "build") rhythmGoodSpawn += 1;
  const label = spec.good
    ? rhythmTheme === "build"
      ? buildName
      : "♪"
    : rhythmTheme === "build"
      ? "崩れ"
      : "変な音";
  button.textContent = label;
  button.setAttribute("aria-label", label);
  if (rhythmTheme === "build") button.classList.add("is-word");
  const note = { el: button, good: spec.good, y: -76, done: false, soundIndex };
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!note.good) {
      resolveRhythmNote(note, "bad");
      return;
    }
    if (noteInRhythmZone(button)) {
      resolveRhythmNote(note, "hit");
      return;
    }
    const noteBox = button.getBoundingClientRect();
    const zoneBox = rhythmHitZoneEl.getBoundingClientRect();
    if (noteBox.bottom < zoneBox.top - 36) return;
    resolveRhythmNote(note, "early");
  });
  rhythmLaneEl.append(button);
  rhythmNotes.push(note);
}

function finishRhythmRun() {
  rhythmPhase = "done";
  rhythmSettled = true;
  if (rhythmRaf) cancelAnimationFrame(rhythmRaf);
  rhythmRaf = 0;
  const built = rhythmCollected >= RHYTHM_SONG.length;
  if (rhythmTheme === "build") {
    if (built) {
      playBuildPhrase();
      finishHitopyBuild();
      return;
    }
    if (rhythmPlayEl) rhythmPlayEl.hidden = true;
    if (rhythmDoneEl) rhythmDoneEl.hidden = false;
    if (rhythmDoneText) {
      rhythmDoneText.textContent =
        "地層が崩れちゃった。もう一度、合図に合わせてトントンしてみて。";
    }
    return;
  }
  if (built) playRhythmSong();
  if (rhythmPlayEl) rhythmPlayEl.hidden = true;
  if (rhythmDoneEl) rhythmDoneEl.hidden = false;
  if (rhythmDoneText) {
    rhythmDoneText.textContent =
      rhythmCollected >= RHYTHM_SONG.length
        ? `一曲あつめたよ。${rhythmPoints}点。`
        : `今回は ${rhythmPoints}点。いい音は ${rhythmCollected} / ${RHYTHM_SONG.length}。`;
  }
  melodySessionScore = rhythmPoints;
  renderMelodyScore();
  saveMelodyBest(rhythmPoints);
}

function settleRhythmChart() {
  if (rhythmSettled) return;
  if (rhythmSpawnIndex < RHYTHM_CHART.length || rhythmNotes.length > 0) return;
  finishRhythmRun();
}

function stepRhythmGame(now) {
  if (rhythmPhase !== "play") return;
  const dt = Math.min(34, rhythmLastFrame ? now - rhythmLastFrame : 16);
  rhythmLastFrame = now;
  rhythmElapsed += dt;
  const travel = Math.max(240, (rhythmLaneEl?.clientHeight || 340) - 8);
  while (
    rhythmSpawnIndex < RHYTHM_CHART.length &&
    rhythmElapsed >= 280 + rhythmSpawnIndex * RHYTHM_GAP_MS
  ) {
    spawnRhythmNote(RHYTHM_CHART[rhythmSpawnIndex]);
    rhythmSpawnIndex += 1;
  }
  [...rhythmNotes].forEach((note) => {
    if (note.done) return;
    note.y += (travel / RHYTHM_FALL_MS) * dt;
    note.el.style.transform = `translate(-50%, ${note.y}px)`;
    if (!rhythmHitZoneEl) return;
    const noteBox = note.el.getBoundingClientRect();
    const zoneBox = rhythmHitZoneEl.getBoundingClientRect();
    const center = noteBox.top + noteBox.height / 2;
    if (center <= zoneBox.bottom + 10) return;
    if (note.good) resolveRhythmNote(note, "miss");
    else {
      removeRhythmNote(note);
      flashRhythmJudge("よけた");
    }
  });
  settleRhythmChart();
  if (rhythmPhase === "play") rhythmRaf = requestAnimationFrame(stepRhythmGame);
}

function startRhythmGame() {
  simpyAudioContext();
  if (rhythmRaf) cancelAnimationFrame(rhythmRaf);
  clearRhythmNotes();
  rhythmPhase = "play";
  rhythmSettled = false;
  rhythmCollected = 0;
  rhythmCombo = 0;
  rhythmPoints = 0;
  rhythmLayers = [];
  rhythmSpawnIndex = 0;
  rhythmGoodSpawn = 0;
  rhythmElapsed = 0;
  rhythmLastFrame = 0;
  if (rhythmIntroEl) rhythmIntroEl.hidden = true;
  if (rhythmDoneEl) rhythmDoneEl.hidden = true;
  if (rhythmPlayEl) rhythmPlayEl.hidden = false;
  if (rhythmJudgeEl) rhythmJudgeEl.textContent = "";
  renderRhythmHud();
  rhythmRaf = requestAnimationFrame(stepRhythmGame);
}

const hitopyStoryLines = [
  "建築現場へようこそ。ぼくはHITOPY。地底に住むみんなの家を建てているんだ。",
  "地底の建築には、地上の建築とは違うルールがあるよ。",
  "地下の土はとても繊細で、適当なタイミングで叩くと地層が崩れちゃう。",
  "地底の家はね、決まったリズムで叩かないと崩れちゃうんだ。",
  "ぼくが合図を出すから、タイミングよくトントンしてみて！",
  "落ちてくる音が光る輪に重なったらクリック。音はトン、カン、ドン。崩れそうな印は押さないで。",
  "準備はいいかな。ゲームスタートを押して、いっしょに家を建てよう。",
];

const hitopyDialogue = document.getElementById("hitopy-dialogue");
const hitopyDialogueText = document.getElementById("hitopy-dialogue-text");
const hitopyDialogueNext = document.getElementById("hitopy-dialogue-next");
const hitopyStoryBack = document.getElementById("hitopy-story-back");
const hitopyStoryPrev = document.getElementById("hitopy-story-prev");
const hitopyGameStart = document.getElementById("hitopy-game-start");
const hitopyGame = document.getElementById("hitopy-game");
const hitopyFinish = document.getElementById("hitopy-finish");
const hitopyFinishMessage = document.getElementById("hitopy-finish-message");
const hitopyFinishHome = document.getElementById("hitopy-finish-home");
const hitopyClearPanel = document.getElementById("hitopy-clear-panel");
const hitopyReplay = document.getElementById("hitopy-replay");
let hitopyStoryIndex = 0;
let hitopyPlaying = false;
let hitopyShowingClear = false;

function hitopyClearStorageKey() {
  return `deepys-hitopy-cleared:${currentUserId || "local"}`;
}

function isHitopyStoryCleared() {
  if (currentUserData?.hitopyCleared) return true;
  if (!progressCanBeSaved()) return false;
  try {
    return localStorage.getItem(hitopyClearStorageKey()) === "1";
  } catch {
    return false;
  }
}

function awardHitopyFriendship() {
  const already = isHitopyStoryCleared();
  if (!already) currentUserData.hitopyCleared = true;

  const nextPoints = already
    ? Math.max(
        resolvedFriendshipPoints(currentUserData.friendshipPoints),
        storyFriendshipFloor(),
      )
    : Math.min(
        100,
        Math.max(
          resolvedFriendshipPoints(currentUserData.friendshipPoints) + 25,
          storyFriendshipFloor(),
        ),
      );

  renderUserData({ friendshipPoints: nextPoints, hitopyCleared: true });
  syncFriendshipPill();

  if (!already && progressCanBeSaved()) {
    try {
      localStorage.setItem(hitopyClearStorageKey(), "1");
    } catch {
      // 保存できない場合も、この画面の表示は更新済み
    }
    writeProfileCache(currentUserId, currentUserData);
    setDoc(
      doc(db, "users", currentUserId),
      { friendshipPoints: nextPoints, hitopyCleared: true },
      { merge: true },
    ).catch((error) => {
      console.error("友情ポイントの保存エラー:", error);
    });
  }
}

function stopHitopyGame() {
  hitopyPlaying = false;
  if (rhythmTheme === "build") stopRhythmGame();
  hitopyStoryView?.classList.remove("is-playing");
  if (hitopyGame) hitopyGame.hidden = true;
  if (hitopyFinish) hitopyFinish.hidden = true;
}

function updateHitopyPrev() {
  if (!hitopyStoryPrev) return;
  const inDialogue =
    !hitopyPlaying && !hitopyShowingClear && hitopyFinish?.hidden !== false;
  hitopyStoryPrev.hidden = !inDialogue;
  hitopyStoryPrev.disabled = hitopyStoryIndex <= 0;
}

function sayHitopy(message, hint = "") {
  if (!hitopyDialogueText) return;
  hitopyDialogueText.textContent = message;
  if (!hitopyDialogueNext) return;
  hitopyDialogueNext.hidden = !hint;
  hitopyDialogueNext.textContent = hint;
  hitopyDialogueNext.classList.remove("is-more");
  updateHitopyPrev();
}

function renderHitopyStory() {
  const isLast = hitopyStoryIndex >= hitopyStoryLines.length - 1;
  const showStart = isLast && !hitopyPlaying && hitopyFinish?.hidden !== false;
  hitopyDialogueText.textContent = hitopyStoryLines[hitopyStoryIndex];
  hitopyGameStart.hidden = !showStart;
  hitopyDialogueNext.hidden = showStart || hitopyPlaying;
  hitopyDialogueNext.textContent = "click";
  hitopyDialogueNext.classList.toggle(
    "is-more",
    !isLast && !showStart && !hitopyPlaying,
  );
  updateHitopyPrev();
}

function startHitopyStory() {
  activeStoryId = "hitopy";
  hitopyStoryIndex = 0;
  hitopyShowingClear = false;
  stopHitopyGame();
  if (hitopyDialogue) hitopyDialogue.hidden = false;
  if (hitopyClearPanel) hitopyClearPanel.hidden = true;
  hitopyStoryView?.classList.remove("is-cleared", "is-built");
  renderHitopyStory();
  switchUndergroundView("story");
}

function showHitopyClearScreen() {
  activeStoryId = "hitopy";
  hitopyShowingClear = true;
  stopHitopyGame();
  if (hitopyDialogue) hitopyDialogue.hidden = true;
  if (hitopyClearPanel) hitopyClearPanel.hidden = false;
  hitopyStoryView?.classList.add("is-cleared", "is-built");
  switchUndergroundView("story");
}

function openHitopyStory() {
  if (isHitopyStoryCleared()) {
    showHitopyClearScreen();
    return;
  }
  startHitopyStory();
}

function advanceHitopyStory() {
  if (hitopyPlaying || hitopyShowingClear || hitopyFinish?.hidden === false)
    return;
  if (hitopyStoryIndex >= hitopyStoryLines.length - 1) return;
  hitopyStoryIndex += 1;
  renderHitopyStory();
}

function rewindHitopyStory() {
  if (hitopyPlaying || hitopyShowingClear) return;
  if (hitopyStoryIndex <= 0) return;
  hitopyStoryIndex -= 1;
  renderHitopyStory();
}

function startHitopyGame() {
  hitopyPlaying = true;
  hitopyShowingClear = false;
  hitopyStoryView?.classList.add("is-playing");
  hitopyStoryView?.classList.remove("is-cleared", "is-built");
  if (hitopyDialogue) hitopyDialogue.hidden = false;
  if (hitopyClearPanel) hitopyClearPanel.hidden = true;
  if (hitopyFinish) hitopyFinish.hidden = true;
  if (hitopyGame) hitopyGame.hidden = false;
  if (hitopyGameStart) hitopyGameStart.hidden = true;
  sayHitopy("光る輪に重なったらクリック。トン、カン、ドン。崩れは押さないで。");
  bindRhythmStage(rhythmBuildStage);
  startRhythmGame();
}

function finishHitopyBuild() {
  if (!hitopyPlaying) return;
  const already = isHitopyStoryCleared();
  awardHitopyFriendship();
  hitopyPlaying = false;
  hitopyStoryView?.classList.remove("is-playing");
  hitopyStoryView?.classList.add("is-built");
  if (hitopyGame) hitopyGame.hidden = true;
  if (hitopyDialogue) hitopyDialogue.hidden = true;
  if (hitopyFinishMessage) {
    hitopyFinishMessage.textContent = already
      ? "ありがとう。またリズムを合わせてくれたね。友情ポイントは、このまえ渡してあるよ。"
      : "ありがとう。家が建ったよ。友情ポイントを25%あげるね。";
  }
  if (hitopyFinish) hitopyFinish.hidden = false;
  hitopyFinishHome?.focus();
}

document
  .querySelectorAll(".character-button[data-character='hitopy']")
  .forEach((button) => {
    button.addEventListener("click", openHitopyStory);
  });

hitopyStoryView?.addEventListener("click", (event) => {
  if (
    event.target.closest(
      "#hitopy-story-back, #hitopy-story-prev, #hitopy-game-start, #hitopy-game, #hitopy-finish, #hitopy-clear-panel",
    )
  ) {
    return;
  }
  advanceHitopyStory();
});

hitopyStoryBack?.addEventListener("click", () => {
  stopHitopyGame();
  switchUndergroundView("home");
});

hitopyStoryPrev?.addEventListener("click", (event) => {
  event.stopPropagation();
  rewindHitopyStory();
});

hitopyGameStart?.addEventListener("click", (event) => {
  event.stopPropagation();
  startHitopyGame();
});

hitopyReplay?.addEventListener("click", (event) => {
  event.stopPropagation();
  startHitopyStory();
});

document
  .getElementById("hitopy-rhythm-again")
  ?.addEventListener("click", (event) => {
    event.stopPropagation();
    bindRhythmStage(rhythmBuildStage);
    startRhythmGame();
  });

hitopyFinishHome?.addEventListener("click", (event) => {
  event.stopPropagation();
  stopHitopyGame();
  switchUndergroundView("home");
});

document.addEventListener("keydown", (event) => {
  if (!hitopyStoryView || hitopyStoryView.hidden) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  if (
    event.target.closest?.(
      "#hitopy-story-back, #hitopy-story-prev, #hitopy-game-start, #hitopy-game, #hitopy-finish-home, #hitopy-replay",
    )
  ) {
    return;
  }
  event.preventDefault();
  if (hitopyFinish && !hitopyFinish.hidden) {
    stopHitopyGame();
    switchUndergroundView("home");
    return;
  }
  if (hitopyGameStart && !hitopyGameStart.hidden) {
    startHitopyGame();
    return;
  }
  advanceHitopyStory();
});

const NASUPY_MIX_DIR = "./調合ゲーム素材";
const NASUPY_INGREDIENTS = [
  { id: "01", name: "むらさききのこ" },
  { id: "02", name: "くすりのバケツ" },
  { id: "03", name: "まきひげの葉" },
  { id: "04", name: "切り株" },
  { id: "05", name: "とろけるビン" },
  { id: "06", name: "ランプ" },
];

const nasupyStoryLines = [
  "深層の診療室へようこそ。ぼくはNASUPY。植物のお医者さんだよ。",
  "具合の悪い葉っぱたちが、新しい薬を待っているんだ。",
  "このボウルで、材料をふたつ調合する。上に並んだものを、ボウルへドラッグしてね。",
  "ひとつ入れると、ボウルの中身が変わる。もうひとつ入れて、薬になる組み合わせを探そう。",
  "準備はいいかな。ゲームスタートを押して、新しい薬作りを手伝って。",
];

const nasupyDialogue = document.getElementById("nasupy-dialogue");
const nasupyDialogueText = document.getElementById("nasupy-dialogue-text");
const nasupyDialogueNext = document.getElementById("nasupy-dialogue-next");
const nasupyStoryBack = document.getElementById("nasupy-story-back");
const nasupyStoryPrev = document.getElementById("nasupy-story-prev");
const nasupyGameStart = document.getElementById("nasupy-game-start");
const nasupyGame = document.getElementById("nasupy-game");
const nasupyItems = document.getElementById("nasupy-items");
const nasupyBowlSlot = document.getElementById("nasupy-bowl-slot");
const nasupyBowlImage = document.getElementById("nasupy-bowl-image");
const nasupyFinish = document.getElementById("nasupy-finish");
const nasupyFinishMessage = document.getElementById("nasupy-finish-message");
const nasupyFinishHome = document.getElementById("nasupy-finish-home");
const nasupyClearPanel = document.getElementById("nasupy-clear-panel");
const nasupyReplay = document.getElementById("nasupy-replay");
let nasupyStoryIndex = 0;
let nasupyPlaying = false;
let nasupyShowingClear = false;
let nasupyFirstId = "";
let nasupyLocked = false;
let nasupyTimers = [];
let nasupyDrag = null;

function nasupyArt(file) {
  return `${NASUPY_MIX_DIR}/${file}`;
}

function nasupyClearStorageKey() {
  return `deepys-nasupy-cleared:${currentUserId || "local"}`;
}

function isNasupyStoryCleared() {
  if (currentUserData?.nasupyCleared) return true;
  if (!progressCanBeSaved()) return false;
  try {
    return localStorage.getItem(nasupyClearStorageKey()) === "1";
  } catch {
    return false;
  }
}

function awardNasupyFriendship() {
  const already = isNasupyStoryCleared();
  if (!already) currentUserData.nasupyCleared = true;

  const nextPoints = already
    ? Math.max(
        resolvedFriendshipPoints(currentUserData.friendshipPoints),
        storyFriendshipFloor(),
      )
    : Math.min(
        100,
        Math.max(
          resolvedFriendshipPoints(currentUserData.friendshipPoints) + 25,
          storyFriendshipFloor(),
        ),
      );

  renderUserData({ friendshipPoints: nextPoints, nasupyCleared: true });
  syncFriendshipPill();

  if (!already && progressCanBeSaved()) {
    try {
      localStorage.setItem(nasupyClearStorageKey(), "1");
    } catch {
      // 保存できない場合も、この画面の表示は更新済み
    }
    writeProfileCache(currentUserId, currentUserData);
    setDoc(
      doc(db, "users", currentUserId),
      { friendshipPoints: nextPoints, nasupyCleared: true },
      { merge: true },
    ).catch((error) => {
      console.error("友情ポイントの保存エラー:", error);
    });
  }
}

function clearNasupyTimers() {
  nasupyTimers.forEach((id) => window.clearTimeout(id));
  nasupyTimers = [];
}

function queueNasupy(action, delay) {
  const timer = window.setTimeout(() => {
    nasupyTimers = nasupyTimers.filter((id) => id !== timer);
    action();
  }, delay);
  nasupyTimers.push(timer);
}

function clearNasupyDrag() {
  document.removeEventListener("pointermove", moveNasupyDrag);
  document.removeEventListener("pointerup", endNasupyDrag);
  document.removeEventListener("pointercancel", endNasupyDrag);
  nasupyDrag?.ghost?.remove();
  nasupyDrag = null;
  nasupyBowlSlot?.classList.remove("is-hot");
}

function setNasupyBowl(file, alt) {
  if (!nasupyBowlImage) return;
  nasupyBowlImage.alt = alt;
  nasupyBowlImage.src = nasupyArt(file);
}

function resetNasupyBoard() {
  clearNasupyTimers();
  clearNasupyDrag();
  nasupyLocked = false;
  nasupyFirstId = "";
  setNasupyBowl("nasupy-bowl.png", "調合のボウル");
  nasupyItems?.querySelectorAll(".nasupy-item").forEach((item) => {
    item.classList.remove("is-used");
  });
}

function stopNasupyGame() {
  nasupyPlaying = false;
  nasupyLocked = false;
  clearNasupyTimers();
  clearNasupyDrag();
  nasupyStoryView?.classList.remove("is-playing");
  if (nasupyGame) nasupyGame.hidden = true;
  if (nasupyFinish) nasupyFinish.hidden = true;
}

function updateNasupyPrev() {
  if (!nasupyStoryPrev) return;
  const inDialogue =
    !nasupyPlaying && !nasupyShowingClear && nasupyFinish?.hidden !== false;
  nasupyStoryPrev.hidden = !inDialogue;
  nasupyStoryPrev.disabled = nasupyStoryIndex <= 0;
}

function sayNasupy(message, hint = "") {
  if (!nasupyDialogueText) return;
  nasupyDialogueText.textContent = message;
  if (!nasupyDialogueNext) return;
  nasupyDialogueNext.hidden = !hint;
  nasupyDialogueNext.textContent = hint;
  nasupyDialogueNext.classList.remove("is-more");
  updateNasupyPrev();
}

function renderNasupyStory() {
  const isLast = nasupyStoryIndex >= nasupyStoryLines.length - 1;
  const showStart = isLast && !nasupyPlaying && nasupyFinish?.hidden !== false;
  nasupyDialogueText.textContent = nasupyStoryLines[nasupyStoryIndex];
  nasupyGameStart.hidden = !showStart;
  nasupyDialogueNext.hidden = showStart || nasupyPlaying;
  nasupyDialogueNext.textContent = "click";
  nasupyDialogueNext.classList.toggle(
    "is-more",
    !isLast && !showStart && !nasupyPlaying,
  );
  updateNasupyPrev();
}

function startNasupyStory() {
  activeStoryId = "nasupy";
  nasupyStoryIndex = 0;
  nasupyShowingClear = false;
  stopNasupyGame();
  resetNasupyBoard();
  if (nasupyDialogue) nasupyDialogue.hidden = false;
  if (nasupyClearPanel) nasupyClearPanel.hidden = true;
  nasupyStoryView?.classList.remove("is-cleared");
  renderNasupyStory();
  switchUndergroundView("story");
}

function showNasupyClearScreen() {
  activeStoryId = "nasupy";
  nasupyShowingClear = true;
  stopNasupyGame();
  if (nasupyDialogue) nasupyDialogue.hidden = true;
  if (nasupyClearPanel) nasupyClearPanel.hidden = false;
  nasupyStoryView?.classList.add("is-cleared");
  switchUndergroundView("story");
}

function openNasupyStory() {
  if (isNasupyStoryCleared()) {
    showNasupyClearScreen();
    return;
  }
  startNasupyStory();
}

function advanceNasupyStory() {
  if (nasupyPlaying || nasupyShowingClear || nasupyFinish?.hidden === false)
    return;
  if (nasupyStoryIndex >= nasupyStoryLines.length - 1) return;
  nasupyStoryIndex += 1;
  renderNasupyStory();
}

function rewindNasupyStory() {
  if (nasupyPlaying || nasupyShowingClear) return;
  if (nasupyStoryIndex <= 0) return;
  nasupyStoryIndex -= 1;
  renderNasupyStory();
}

function finishNasupyGame() {
  if (!nasupyPlaying) return;
  const already = isNasupyStoryCleared();
  awardNasupyFriendship();
  nasupyPlaying = false;
  nasupyLocked = true;
  clearNasupyDrag();
  if (nasupyDialogue) nasupyDialogue.hidden = true;
  if (nasupyFinishMessage) {
    nasupyFinishMessage.textContent = already
      ? "ありがとう。また新しい薬を一緒に作ってくれたね。友情ポイントは、このまえ渡してあるよ。"
      : "ありがとう。新しい薬ができたよ。友情ポイントを25%あげるね。";
  }
  if (nasupyFinish) nasupyFinish.hidden = false;
  nasupyFinishHome?.focus();
}

function placeNasupyIngredient(id) {
  if (nasupyLocked || !nasupyPlaying) return;
  const item = nasupyItems?.querySelector(`[data-item="${id}"]`);
  if (!item || item.classList.contains("is-used")) return;

  if (!nasupyFirstId) {
    nasupyFirstId = id;
    item.classList.add("is-used");
    setNasupyBowl(`nasupy-item${id}-mix.png`, "材料が入ったボウル");
    sayNasupy("ひとつ入った。もうひとつ、ボウルに入れてみて。");
    return;
  }

  item.classList.add("is-used");
  nasupyLocked = true;
  const success =
    nasupyFirstId !== id &&
    (nasupyFirstId === "02" || nasupyFirstId === "03") &&
    (id === "02" || id === "03");
  if (!success) {
    setNasupyBowl("nasupy-error.png", "調合失敗");
    sayNasupy("これは新しい薬にならなかった。もう一度、ふたつ選んでみて。");
    queueNasupy(() => {
      if (!nasupyPlaying) return;
      resetNasupyBoard();
      sayNasupy("材料をボウルへドラッグして、ふたつ調合してね。");
    }, 2200);
    return;
  }

  setNasupyBowl("nasupy-thinking.png", "調合を考えている");
  sayNasupy("この組み合わせだ。少し、考えさせて。");
  queueNasupy(() => {
    if (!nasupyPlaying) return;
    setNasupyBowl("nasupy-success.png", "新しい薬ができた");
    sayNasupy("できた。植物たちのための、新しい薬だよ。");
    queueNasupy(finishNasupyGame, 1200);
  }, 1500);
}

function nasupyPointerHitsBowl(x, y) {
  const pad = 72;
  const rects = [nasupyBowlImage, nasupyBowlSlot]
    .map((element) => element?.getBoundingClientRect())
    .filter((rect) => rect && rect.width > 0 && rect.height > 0);
  return rects.some(
    (rect) =>
      x >= rect.left - pad &&
      x <= rect.right + pad &&
      y >= rect.top - pad &&
      y <= rect.bottom + pad,
  );
}

function positionNasupyGhost(ghost, x, y) {
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
}

function beginNasupyDrag(event) {
  if (nasupyLocked || !nasupyPlaying) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const item = event.currentTarget;
  if (item.classList.contains("is-used")) return;
  if (event.pointerType !== "mouse") event.preventDefault();
  event.stopPropagation();
  const image = item.querySelector("img");
  const ghost = image?.cloneNode(true);
  if (ghost) {
    ghost.className = "nasupy-drag-ghost";
    ghost.alt = "";
    document.body.append(ghost);
    positionNasupyGhost(ghost, event.clientX, event.clientY);
  }
  nasupyDrag = {
    id: item.dataset.item,
    ghost,
    item,
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    native: false,
  };
  document.addEventListener("pointermove", moveNasupyDrag);
  document.addEventListener("pointerup", endNasupyDrag);
  document.addEventListener("pointercancel", endNasupyDrag);
  nasupyBowlSlot?.classList.toggle(
    "is-hot",
    nasupyPointerHitsBowl(event.clientX, event.clientY),
  );
}

function moveNasupyDrag(event) {
  if (
    !nasupyDrag ||
    event.pointerId !== nasupyDrag.pointerId ||
    nasupyDrag.native
  )
    return;
  nasupyDrag.x = event.clientX;
  nasupyDrag.y = event.clientY;
  if (nasupyDrag.ghost)
    positionNasupyGhost(nasupyDrag.ghost, event.clientX, event.clientY);
  nasupyBowlSlot?.classList.toggle(
    "is-hot",
    nasupyPointerHitsBowl(event.clientX, event.clientY),
  );
}

function endNasupyDrag(event) {
  if (!nasupyDrag || nasupyDrag.native) return;
  if (event.pointerId !== undefined && event.pointerId !== nasupyDrag.pointerId)
    return;
  const x = event.clientX || nasupyDrag.x;
  const y = event.clientY || nasupyDrag.y;
  const id = nasupyDrag.id;
  const dropped = nasupyPointerHitsBowl(x, y);
  clearNasupyDrag();
  if (dropped) placeNasupyIngredient(id);
}

function beginNasupyNativeDrag(event) {
  const item = event.currentTarget;
  if (nasupyLocked || !nasupyPlaying || item.classList.contains("is-used")) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.setData("application/x-nasupy-item", item.dataset.item);
  event.dataTransfer.setData("text/plain", item.dataset.item);
  event.dataTransfer.effectAllowed = "copy";
  const image = item.querySelector("img");
  if (image)
    event.dataTransfer.setDragImage(image, image.width / 2, image.height / 2);
  if (nasupyDrag?.ghost) nasupyDrag.ghost.remove();
  nasupyDrag = {
    id: item.dataset.item,
    ghost: null,
    item,
    pointerId: null,
    x: 0,
    y: 0,
    native: true,
  };
}

function allowNasupyDrop(event) {
  if (!nasupyPlaying || nasupyLocked) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  nasupyBowlSlot?.classList.add("is-hot");
}

function dropNasupyIngredient(event) {
  if (!nasupyPlaying || nasupyLocked) return;
  event.preventDefault();
  event.stopPropagation();
  const id =
    event.dataTransfer?.getData("application/x-nasupy-item") ||
    event.dataTransfer?.getData("text/plain");
  clearNasupyDrag();
  if (id) placeNasupyIngredient(id);
}

function buildNasupyItems() {
  if (!nasupyItems || nasupyItems.childElementCount) return;
  NASUPY_INGREDIENTS.forEach((ingredient) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nasupy-item";
    button.draggable = true;
    button.dataset.item = ingredient.id;
    button.setAttribute("aria-label", ingredient.name);
    const image = document.createElement("img");
    image.src = nasupyArt(`nasupy-item${ingredient.id}.png`);
    image.alt = "";
    image.draggable = true;
    button.append(image);
    button.addEventListener("pointerdown", beginNasupyDrag);
    button.addEventListener("dragstart", beginNasupyNativeDrag);
    button.addEventListener("dragend", () => {
      if (nasupyDrag?.native) clearNasupyDrag();
    });
    button.addEventListener("click", (event) => event.stopPropagation());
    nasupyItems.append(button);
  });
  if (!nasupyBowlSlot.dataset.dropReady) {
    nasupyBowlSlot.dataset.dropReady = "1";
    nasupyBowlSlot.addEventListener("dragenter", allowNasupyDrop);
    nasupyBowlSlot.addEventListener("dragover", allowNasupyDrop);
    nasupyBowlSlot.addEventListener("dragleave", () =>
      nasupyBowlSlot.classList.remove("is-hot"),
    );
    nasupyBowlSlot.addEventListener("drop", dropNasupyIngredient);
  }
}

function startNasupyGame() {
  buildNasupyItems();
  nasupyPlaying = true;
  nasupyShowingClear = false;
  nasupyStoryView?.classList.add("is-playing");
  nasupyStoryView?.classList.remove("is-cleared");
  if (nasupyDialogue) nasupyDialogue.hidden = false;
  if (nasupyClearPanel) nasupyClearPanel.hidden = true;
  if (nasupyFinish) nasupyFinish.hidden = true;
  if (nasupyGame) nasupyGame.hidden = false;
  if (nasupyGameStart) nasupyGameStart.hidden = true;
  resetNasupyBoard();
  sayNasupy("材料をボウルへドラッグして、ふたつ調合してね。");
}

document
  .querySelectorAll(".character-button[data-character='nasupy']")
  .forEach((button) => {
    button.addEventListener("click", openNasupyStory);
  });

nasupyStoryView?.addEventListener("dragover", (event) => {
  if (!nasupyPlaying || nasupyLocked || event.target.closest(".nasupy-item"))
    return;
  allowNasupyDrop(event);
});

nasupyStoryView?.addEventListener("drop", (event) => {
  if (!nasupyPlaying || event.target.closest(".nasupy-item")) return;
  dropNasupyIngredient(event);
});

nasupyStoryView?.addEventListener("click", (event) => {
  if (
    event.target.closest(
      "#nasupy-story-back, #nasupy-story-prev, #nasupy-game-start, #nasupy-game, #nasupy-finish, #nasupy-clear-panel",
    )
  ) {
    return;
  }
  advanceNasupyStory();
});

nasupyStoryBack?.addEventListener("click", () => {
  stopNasupyGame();
  switchUndergroundView("home");
});

nasupyStoryPrev?.addEventListener("click", (event) => {
  event.stopPropagation();
  rewindNasupyStory();
});

nasupyGameStart?.addEventListener("click", (event) => {
  event.stopPropagation();
  startNasupyGame();
});

nasupyReplay?.addEventListener("click", (event) => {
  event.stopPropagation();
  startNasupyStory();
});

nasupyFinishHome?.addEventListener("click", (event) => {
  event.stopPropagation();
  stopNasupyGame();
  switchUndergroundView("home");
});

document.addEventListener("keydown", (event) => {
  if (!nasupyStoryView || nasupyStoryView.hidden) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  if (
    event.target.closest?.(
      "#nasupy-story-back, #nasupy-story-prev, #nasupy-game-start, #nasupy-game, #nasupy-finish-home, #nasupy-replay",
    )
  ) {
    return;
  }
  event.preventDefault();
  if (nasupyFinish && !nasupyFinish.hidden) {
    stopNasupyGame();
    switchUndergroundView("home");
    return;
  }
  if (nasupyGameStart && !nasupyGameStart.hidden) {
    startNasupyGame();
    return;
  }
  advanceNasupyStory();
});

// フレーム付きカメラ（「スマホで保存」を選んだ写真だけ24時間共有する）
const cameraVideo = document.getElementById("camera-video");
const cameraResult = document.getElementById("camera-result");
const cameraStage = document.getElementById("camera-stage");
const cameraMessage = document.getElementById("camera-message");
const startCameraButton = document.getElementById("start-camera");
const takePhotoButton = document.getElementById("take-photo");
const retakePhotoButton = document.getElementById("retake-photo");
const downloadPhotoLink = document.getElementById("download-photo");
const togglePhotoCornersButton = document.getElementById(
  "toggle-photo-corners",
);
const photoRewardDialog = document.getElementById("photo-reward-dialog");
const closePhotoRewardButton = document.getElementById("close-photo-reward");
const frameChoices = document.querySelectorAll(".frame-choice");
const frameImages = document.querySelectorAll("[data-frame-image]");
let cameraStream = null;
let selectedFrame = "frame-1";
let roundedPhotoCorners = false;
const photoSharing = setupPhotoSharing();

function updateCameraFrameOrientation() {
  const frameImage = document.querySelector(
    `[data-frame-image="${selectedFrame}"]`,
  );
  // 非表示のフレームが読み込み待ちなら、同じ画像のサムネイルを参照する。
  const image =
    frameImage?.naturalWidth > 0
      ? frameImage
      : document.querySelector(
          `.frame-choice[data-frame="${selectedFrame}"] img`,
        );
  if (!image?.naturalWidth || !image.naturalHeight) return;
  cameraStage?.classList.toggle(
    "is-landscape",
    image.naturalWidth > image.naturalHeight,
  );
  cameraStage?.style.setProperty(
    "--camera-frame-ratio",
    String(image.naturalWidth / image.naturalHeight),
  );
}

document
  .querySelectorAll(".frame-choice img, [data-frame-image]")
  .forEach((image) => {
    image.addEventListener("load", updateCameraFrameOrientation);
  });
updateCameraFrameOrientation();

togglePhotoCornersButton?.addEventListener("click", () => {
  roundedPhotoCorners = !roundedPhotoCorners;
  cameraStage?.classList.toggle("is-rounded", roundedPhotoCorners);
  cameraStage?.classList.toggle("is-square-cornered", !roundedPhotoCorners);
  togglePhotoCornersButton.setAttribute(
    "aria-checked",
    String(roundedPhotoCorners),
  );
});

function stopCamera() {
  photoSharing.reset();
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  if (cameraVideo) {
    cameraVideo.srcObject = null;
    cameraVideo.classList.remove("is-mirrored");
  }
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
    setCameraMessage(
      "カメラを使うにはlocalhostまたはHTTPSでページを開いてね。index.htmlを直接開いた場合は利用できません。",
    );
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraMessage(
      "このブラウザーではカメラを利用できません。対応ブラウザーでページを開いてね。",
    );
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
    const facingMode = cameraStream
      .getVideoTracks()[0]
      ?.getSettings().facingMode;
    cameraVideo.classList.toggle(
      "is-mirrored",
      !facingMode || facingMode === "user",
    );
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
      setCameraMessage(
        "カメラの許可が必要です。アドレスバー横、またはブラウザー設定でこのサイトのカメラを許可してね。",
      );
    } else if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
      setCameraMessage(
        "カメラが見つかりません。カメラが接続されているか確認してね。",
      );
    } else if (
      error.name === "NotReadableError" ||
      error.name === "TrackStartError"
    ) {
      setCameraMessage(
        "カメラを別のアプリが使用中のようです。他のアプリを閉じてからもう一度試してね。",
      );
    } else {
      setCameraMessage(
        "カメラを起動できませんでした。ブラウザーとOSのカメラ許可を確認してね。",
      );
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
    updateCameraFrameOrientation();
    // 切り替えたフレームが撮影結果にも反映されるよう、再撮影を案内する。
    if (!cameraResult.hidden) {
      photoSharing.reset();
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
  const selectedImage = document.querySelector(
    `[data-frame-image="${selectedFrame}"]`,
  );
  if (!selectedImage?.complete || !selectedImage.naturalWidth) {
    setCameraMessage(
      selectedImage?.complete
        ? "フレームを読み込めませんでした。ページを開き直してね。"
        : "フレームを読み込んでいます。少し待ってから、もう一度撮ってね。",
    );
    return;
  }
  const canvas = document.createElement("canvas");
  const isLandscape = selectedImage.naturalWidth > selectedImage.naturalHeight;
  canvas.width = isLandscape ? 1440 : 960;
  canvas.height = Math.round(
    (canvas.width * selectedImage.naturalHeight) / selectedImage.naturalWidth,
  );
  const context = canvas.getContext("2d");

  if (roundedPhotoCorners) {
    const cornerRadius = Math.min(canvas.width, canvas.height) * 0.055;
    context.beginPath();
    context.roundRect(0, 0, canvas.width, canvas.height, cornerRadius);
    context.clip();
  }

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

  context.save();
  if (cameraVideo.classList.contains("is-mirrored")) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(
    cameraVideo,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  context.restore();

  context.drawImage(selectedImage, 0, 0, canvas.width, canvas.height);
  cameraResult.src = canvas.toDataURL("image/png");
  downloadPhotoLink.href = cameraResult.src;
  cameraResult.hidden = false;
  takePhotoButton.disabled = true;
  retakePhotoButton.hidden = false;
  downloadPhotoLink.hidden = false;
  photoRewardDialog.hidden = false;
  closePhotoRewardButton.focus();
  setCameraMessage("", false);
  photoSharing.show(cameraResult.src);
});

retakePhotoButton?.addEventListener("click", () => {
  photoSharing.reset();
  cameraResult.hidden = true;
  takePhotoButton.disabled = !cameraStream;
  retakePhotoButton.hidden = true;
  downloadPhotoLink.hidden = true;
  photoRewardDialog.hidden = true;
  setCameraMessage("", false);
});

// ユーザー情報を右上バー・私の家・プロフィールに反映
function renderUserData(data) {
  currentUserData = withSavedFriendship({ ...currentUserData, ...data });

  // 右上ステータスバー
  if (topbarAvatar) {
    renderAvatar(topbarAvatar, currentUserData, 28);
  }
  if (homeNickname) {
    homeNickname.textContent = `${currentUserData.nickname || "ゲスト"}さん`;
  }
  syncFriendshipPill();

  // ① 私の家カード
  spaceHousing.render(currentUserData.spaceHouses);

  // ② プロフィールカード
  if (profileAvatarDisplay) {
    renderAvatar(profileAvatarDisplay, currentUserData, 52);
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
    const tags = Array.isArray(currentUserData.tags)
      ? currentUserData.tags
      : ["デザイン", "カフェ巡り", "音楽"];
    renderProfileTags(profileTags, tags);
  }
  renderBoardAvatars();
}

function renderProfileTags(container, tags) {
  container.replaceChildren();
  tags.forEach((tagText) => {
    const cleanTag = String(tagText).replace(/^#/, "").trim();
    if (!cleanTag) return;
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = `#${cleanTag}`;
    container.appendChild(span);
  });
}

function openResidentProfile(uid, house) {
  const resident = latestUsersDocs.find((user) => user.id === uid);
  if (!resident || residentProfileDialog.open) return;
  residentProfileOwnerId = uid;
  renderAvatar(residentProfileAvatar, resident, 36);
  residentProfileName.textContent = resident.nickname || "地底の住人";
  residentProfileHouse.src = `./images/${house.type}.png`;
  residentProfileHouse.classList.toggle("is-flipped", house.flipped);
  renderResidentStatus(isUserOnline(resident, Date.now()));
  const bio = typeof resident.bio === "string" ? resident.bio.trim() : "";
  residentProfileBio.textContent = bio;
  residentProfileIntro.hidden = !bio;
  renderProfileTags(
    residentProfileTags,
    Array.isArray(resident.tags)
      ? resident.tags.filter((tag) => typeof tag === "string")
      : [],
  );
  residentProfileBody.hidden = !bio && !residentProfileTags.childElementCount;
  residentProfileDialog.showModal();
}

residentProfileDialog.addEventListener("click", (event) => {
  if (event.target !== residentProfileDialog) return;
  const { left, top, right, bottom } =
    residentProfileDialog.getBoundingClientRect();
  if (
    event.clientX < left ||
    event.clientX >= right ||
    event.clientY < top ||
    event.clientY >= bottom
  ) {
    residentProfileDialog.close();
  }
});

residentProfileDialog.addEventListener("close", () => {
  if (residentProfileDialog.open) return;
  const uid = residentProfileOwnerId;
  residentProfileOwnerId = null;
  // The users listener can replace the house button while the dialog is open.
  if (!uid || spaceViewContent.hidden || homeScreen.hidden) return;
  const focused = document.activeElement;
  if (focused !== document.body && !residentProfileDialog.contains(focused))
    return;
  const trigger = spaceMapViewport.querySelector(
    `.resident-house[data-owner-id="${CSS.escape(uid)}"] .resident-house-trigger`,
  );
  (trigger || spaceMapViewport).focus({ preventScroll: true });
});

// リアルタイムオンライン人数
function isUserOnline(user, now) {
  return (
    user?.isOnline === true &&
    typeof user.lastActiveMs === "number" &&
    now - user.lastActiveMs < ONLINE_TIMEOUT_MS
  );
}

function renderResidentStatus(online) {
  const label = online ? "オンライン" : "オフライン";
  if (residentProfileStatus.textContent === label) return;
  residentProfileStatus.classList.toggle("is-online", online);
  residentProfileStatus.textContent = label;
}

function recalculateOnlineCount() {
  const now = Date.now();
  const count = latestUsersDocs.filter((user) =>
    isUserOnline(user, now),
  ).length;

  if (residentProfileDialog.open) {
    const resident = latestUsersDocs.find(
      (user) => user.id === residentProfileOwnerId,
    );
    renderResidentStatus(isUserOnline(resident, now));
  }

  if (onlineCountEl) {
    onlineCountEl.textContent = `${Math.max(count, currentUserId ? 1 : 0)}人`;
  }
}

async function sendPresenceHeartbeat(isOnline = true) {
  if (!progressCanBeSaved()) return;
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
          latestUsersDocs.push({ id: docSnap.id, ...docSnap.data() });
        });
        const resident = latestUsersDocs.find(
          (user) => user.id === residentProfileOwnerId,
        );
        if (residentProfileDialog.open && resident)
          renderAvatar(residentProfileAvatar, resident, 36);
        renderBoardAvatars();
        recalculateOnlineCount();
        spaceHousing.renderResidents(latestUsersDocs, currentUserId);
        publishRhythmRanking();
      },
      (error) => {
        console.warn("オンライン人数の取得に失敗:", error);
        if (onlineCountEl) onlineCountEl.textContent = "1人";
        melodyRankError = "みんなの記録を読み込めなかったよ。";
        renderMelodyRanking();
      },
    );
  }
}

function endBrowserSession() {
  const user = auth.currentUser;
  const uid = currentUserId;
  const registered = Boolean(user && !user.isAnonymous && uid);
  if (registered) {
    setDoc(
      doc(db, "users", uid),
      { isOnline: false, lastActiveMs: Date.now() },
      { merge: true },
    ).catch(() => {});
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

window.addEventListener("pagehide", () => {
  endBrowserSession();
});

window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  const user = auth.currentUser;
  if (user && user.uid === currentUserId && !homeScreen.hidden) {
    returningFromSindan();
    startOnlinePresence();
  } else {
    restoreAccountSession();
  }
});

// 相対時間のフォーマット
function formatRelativeTime(timestamp) {
  if (!timestamp || !timestamp.toDate) return "たった今";
  const diffSec = Math.floor(
    (Date.now() - timestamp.toDate().getTime()) / 1000,
  );
  if (diffSec < 60) return "たった今";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}日前`;
}

// 掲示板のリアルタイム購読開始
function startHouseMessagesListener() {
  if (unsubscribeHouseMessages) return;
  // Keep this separate from the board's 20-post preview so every resident is covered.
  const recentPostsQuery = query(
    collection(db, "posts"),
    where("createdAt", ">=", new Date(Date.now() - HOUSE_MESSAGE_LIFETIME_MS)),
    orderBy("createdAt", "desc"),
  );
  unsubscribeHouseMessages = onSnapshot(
    recentPostsQuery,
    (snapshot) => {
      const posts = [];
      snapshot.forEach((docSnap) => {
        posts.push(docSnap.data({ serverTimestamps: "estimate" }));
      });
      spaceHousing.renderMessages(posts);
    },
    (error) => {
      console.warn("家のひとことの取得に失敗:", error);
      spaceHousing.renderMessages([]);
    },
  );
}

function startBoardListener() {
  startHouseMessagesListener();
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
        avatarDiv.dataset.uid = post.uid || "";
        avatarDiv.dataset.avatar = post.avatar || "pink";

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
      renderBoardAvatars();
    },
    (error) => {
      console.error("掲示板の取得エラー:", error);
      boardList.innerHTML =
        '<p class="board-empty">掲示板の読み込みに失敗しました。</p>';
    },
  );
}

function renderBoardAvatars() {
  const residents = new Map(latestUsersDocs.map((user) => [user.id, user]));
  boardList.querySelectorAll(".board-avatar").forEach((container) => {
    const uid = container.dataset.uid;
    const profile =
      uid === currentUserId ? currentUserData : residents.get(uid);
    renderAvatar(
      container,
      {
        avatar: profile?.avatar ?? container.dataset.avatar,
        avatarImage: profile?.avatarImage,
      },
      30,
    );
  });
}

// ホーム画面入場時の共通初期化
function requestedDiagnosisView() {
  if (new URLSearchParams(location.search).get("view") !== "diagnosis")
    return false;
  const url = new URL(location.href);
  url.searchParams.delete("view");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  return true;
}

function enterHomeWithUser(uid, userData) {
  mapNeedsInitialFocus = true;
  if (uid !== currentUserId) closeProfileEditForm();
  currentUserId = uid;
  renderUserData(userData || {});
  spaceHousing.renderResidents(latestUsersDocs, uid);
  switchUndergroundView(requestedDiagnosisView() ? "diagnosis" : "home");
  showScreen(homeScreen);
  // 画面を出してから通信を始める。人数と掲示板の取得で最初の表示を止めない
  requestAnimationFrame(() => {
    if (currentUserId !== uid || homeScreen.hidden) return;
    startOnlinePresence();
    startBoardListener();
  });
}

// ② プロフィール：編集＆Firebase保存
let avatarSelection = 0;
let pendingAvatarFields = null;

function showProfileAvatarPanel(panelId) {
  if (
    panelId === profileAvatarPresets.id &&
    !profileAvatarPresets.childElementCount
  ) {
    buildProfileAvatarPresets();
  }
  profileAvatarModeButtons.forEach((button) => {
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    const expanded = panel.id === panelId;
    panel.hidden = !expanded;
    button.setAttribute("aria-expanded", String(expanded));
  });
}

function renderProfileAvatarPreview() {
  const profile = { ...currentUserData, ...pendingAvatarFields };
  renderAvatar(profileAvatarPreview, profile, 52);
  const selected = isAvatarImage(profile.avatarImage)
    ? null
    : avatarPresetKey(profile.avatar);
  profileAvatarPresets.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.value === selected));
  });
}

profileAvatarModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    showProfileAvatarPanel(
      expanded ? null : button.getAttribute("aria-controls"),
    );
  });
});

function buildProfileAvatarPresets() {
  for (const [avatar, preset] of Object.entries(AVATAR_PRESETS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.value = avatar;
    button.className = "profile-avatar-option";
    button.title = preset.label;
    button.setAttribute("aria-label", preset.label);
    renderAvatar(button, { avatar }, 32);
    button.addEventListener("click", () => {
      avatarSelection += 1;
      pendingAvatarFields = { avatar, avatarImage: null };
      profileAvatarInput.value = "";
      profileSaveBtn.disabled = false;
      profileEditStatus.textContent = "";
      renderProfileAvatarPreview();
    });
    profileAvatarPresets.append(button);
  }
  renderProfileAvatarPreview();
}

async function prepareAvatarImage(file) {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();

    const canvas = document.createElement("canvas");
    const size = 192;
    const crop = Math.min(image.naturalWidth, image.naturalHeight);
    canvas.width = size;
    canvas.height = size;
    canvas
      .getContext("2d")
      .drawImage(
        image,
        (image.naturalWidth - crop) / 2,
        (image.naturalHeight - crop) / 2,
        crop,
        crop,
        0,
        0,
        size,
        size,
      );
    const data = canvas.toDataURL("image/webp", 0.82);
    if (isAvatarImage(data)) return data;

    const jpeg = canvas.toDataURL("image/jpeg", 0.85);
    if (isAvatarImage(jpeg)) return jpeg;
    throw new Error("アイコン画像を作成できませんでした。");
  } finally {
    URL.revokeObjectURL(source);
  }
}

function openProfileEditForm() {
  renderProfileAvatarPreview();
  profileNicknameInput.value = currentUserData.nickname || "";
  profileBioInput.value = currentUserData.bio || "";
  const tagsList = Array.isArray(currentUserData.tags)
    ? currentUserData.tags
    : [];
  profileTagsInput.value = tagsList.join(", ");
  profileEditForm.hidden = false;
  toggleProfileEditBtn.setAttribute("aria-expanded", "true");
}

function closeProfileEditForm() {
  avatarSelection += 1;
  pendingAvatarFields = null;
  profileEditForm.hidden = true;
  profileEditForm.reset();
  showProfileAvatarPanel(null);
  profileAvatarPreview.replaceChildren();
  profileEditStatus.textContent = "";
  profileEditFields.disabled = false;
  profileSaveBtn.disabled = false;
  toggleProfileEditBtn.disabled = false;
  toggleProfileEditBtn.setAttribute("aria-expanded", "false");
}

toggleProfileEditBtn.addEventListener("click", () => {
  if (profileEditForm.hidden) {
    openProfileEditForm();
  } else {
    closeProfileEditForm();
  }
});

cancelProfileEditBtn.addEventListener("click", () => {
  closeProfileEditForm();
  toggleProfileEditBtn.focus();
});

profileAvatarInput.addEventListener("change", async () => {
  const selection = ++avatarSelection;
  const file = profileAvatarInput.files[0];
  profileEditStatus.textContent = "";
  profileSaveBtn.disabled = false;
  if (!file) return;

  if (file.type && !AVATAR_FILE_TYPES.includes(file.type)) {
    profileAvatarInput.value = "";
    profileEditStatus.textContent = "JPEG・PNG・WebP の画像を選んでね。";
    return;
  }
  if (file.size > MAX_AVATAR_FILE_SIZE) {
    profileAvatarInput.value = "";
    profileEditStatus.textContent = "10 MB 以下の画像を選んでね。";
    return;
  }

  profileSaveBtn.disabled = true;
  profileEditStatus.textContent = "画像を読み込んでいます…";
  try {
    const avatarImage = await prepareAvatarImage(file);
    if (selection !== avatarSelection) return;
    pendingAvatarFields = { avatarImage };
    renderProfileAvatarPreview();
    profileEditStatus.textContent = "";
  } catch {
    if (selection !== avatarSelection) return;
    profileAvatarInput.value = "";
    profileEditStatus.textContent =
      "画像を読み込めませんでした。別の画像を選んでね。";
  } finally {
    if (selection === avatarSelection) profileSaveBtn.disabled = false;
  }
});

profileEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (
    profileEditForm.hidden ||
    profileEditFields.disabled ||
    profileSaveBtn.disabled
  )
    return;
  const newNickname = profileNicknameInput.value.trim();
  const newBio = profileBioInput.value.trim();
  const newTags = profileTagsInput.value
    .split(/[,、\s]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  if (!newNickname) return;

  const updatedFields = {
    ...pendingAvatarFields,
    nickname: newNickname,
    bio: newBio || "地底でのんびり暮らしてます。よろしくお願いします！",
    tags: newTags.length > 0 ? newTags : ["地底生活"],
  };

  const user = auth.currentUser;
  const uid = currentUserId;
  const version = sessionVersion;
  if (!progressCanBeSaved()) {
    renderUserData(updatedFields);
    closeProfileEditForm();
    toggleProfileEditBtn.focus();
    return;
  }

  if (user.uid !== uid) return;
  profileEditFields.disabled = true;
  toggleProfileEditBtn.disabled = true;
  profileEditStatus.textContent = "プロフィールを保存しています…";

  try {
    await setDoc(doc(db, "users", uid), updatedFields, { merge: true });
  } catch (error) {
    console.error("プロフィール保存エラー:", error);
    if (
      version === sessionVersion &&
      uid === currentUserId &&
      auth.currentUser?.uid === uid
    ) {
      profileEditFields.disabled = false;
      toggleProfileEditBtn.disabled = false;
      profileEditStatus.textContent =
        "プロフィールを保存できませんでした。もう一度試してね。";
    }
    return;
  }

  if (
    version !== sessionVersion ||
    uid !== currentUserId ||
    auth.currentUser?.uid !== uid
  )
    return;
  const nicknameChanged = currentUserData.nickname !== newNickname;
  renderUserData(updatedFields);
  if (pendingGuestDocData)
    pendingGuestDocData = { ...pendingGuestDocData, ...updatedFields };
  writeProfileCache(uid, currentUserData);
  closeProfileEditForm();
  toggleProfileEditBtn.focus();
  if (!nicknameChanged) return;
  updateProfile(user, { displayName: newNickname }).catch(() => {});
  touchMelodyProfile();
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
      avatar: avatarPresetKey(currentUserData.avatar),
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
// ④ 交流スペース：固定サイズのワールドを、カメラで上下左右に探索する。
// =========================================
const spaceMapViewport = document.getElementById("space-map-viewport");
const currentLayerIndicator = document.getElementById(
  "current-layer-indicator",
);
const spaceMinimapSurface = document.getElementById("space-minimap-surface");
const spaceMinimapWindow = document.getElementById("space-minimap-window");

function focusMapOnHome() {
  const house = spaceMapViewport.querySelector(".own-house");
  if (!house) {
    spaceMapViewport.scrollTo({
      left: (spaceMapViewport.scrollWidth - spaceMapViewport.clientWidth) / 2,
      top: 0,
    });
    return;
  }
  const viewportRect = spaceMapViewport.getBoundingClientRect();
  const houseRect = house.getBoundingClientRect();
  spaceMapViewport.scrollTo({
    left:
      spaceMapViewport.scrollLeft +
      houseRect.left -
      viewportRect.left +
      houseRect.width / 2 -
      spaceMapViewport.clientWidth * 0.42,
    top:
      spaceMapViewport.scrollTop +
      houseRect.top -
      viewportRect.top +
      houseRect.height / 2 -
      spaceMapViewport.clientHeight * 0.55,
    behavior: "auto",
  });
}

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
  if (spaceMapViewport.scrollWidth && scrollHeight) {
    spaceMinimapWindow.style.width = `${(spaceMapViewport.clientWidth / spaceMapViewport.scrollWidth) * 100}%`;
    spaceMinimapWindow.style.height = `${(viewportHeight / scrollHeight) * 100}%`;
    spaceMinimapWindow.style.left = `${(spaceMapViewport.scrollLeft / spaceMapViewport.scrollWidth) * 100}%`;
    spaceMinimapWindow.style.top = `${(scrollTop / scrollHeight) * 100}%`;
  }
}

document
  .getElementById("space-go-home")
  .addEventListener("click", focusMapOnHome);
spaceMinimapSurface.addEventListener("click", (event) => {
  const rect = spaceMinimapSurface.getBoundingClientRect();
  spaceMapViewport.scrollTo({
    left:
      ((event.clientX - rect.left) / rect.width) *
        spaceMapViewport.scrollWidth -
      spaceMapViewport.clientWidth / 2,
    top:
      ((event.clientY - rect.top) / rect.height) *
        spaceMapViewport.scrollHeight -
      spaceMapViewport.clientHeight / 2,
    behavior: "auto",
  });
});
spaceMinimapSurface.addEventListener("keydown", (event) => {
  const directions = {
    ArrowLeft: [-200, 0],
    ArrowRight: [200, 0],
    ArrowUp: [0, -200],
    ArrowDown: [0, 200],
  };
  const direction = directions[event.key];
  if (direction) {
    event.preventDefault();
    spaceMapViewport.scrollBy({ left: direction[0], top: direction[1] });
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    focusMapOnHome();
  }
});

if (spaceMapViewport) {
  // スクロール時に深度表示を同期
  spaceMapViewport.addEventListener("scroll", updateMapScrollbar, {
    passive: true,
  });
  window.addEventListener("resize", updateMapScrollbar);
  new ResizeObserver(updateMapScrollbar).observe(spaceMapViewport);

  // Capture only after a drag threshold, so a click can place a house or open a profile.
  let drag = null;
  let suppressMapClick = false;

  spaceMapViewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    suppressMapClick = false;
    if (
      event.target.closest(
        "button:not(.resident-house-trigger), a, input, select, textarea, .house-speech",
      )
    )
      return;
    // Native touch scrolling supports both axes and cancels taps after a swipe.
    if (event.pointerType === "touch") return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: spaceMapViewport.scrollLeft,
      top: spaceMapViewport.scrollTop,
      moved: false,
    };
  });

  spaceMapViewport.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      spaceMapViewport.classList.add("is-dragging");
      spaceMapViewport.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    spaceMapViewport.scrollLeft = drag.left - dx;
    spaceMapViewport.scrollTop = drag.top - dy;
  });

  const stopMapDragging = (event) => {
    if (
      !drag ||
      (event?.pointerId !== undefined && event.pointerId !== drag.id)
    )
      return;
    suppressMapClick = drag.moved;
    const pointerId = drag.id;
    drag = null;
    spaceMapViewport.classList.remove("is-dragging");
    if (spaceMapViewport.hasPointerCapture(pointerId))
      spaceMapViewport.releasePointerCapture(pointerId);
  };

  window.addEventListener("pointerup", stopMapDragging);
  window.addEventListener("pointercancel", stopMapDragging);
  window.addEventListener("blur", () => stopMapDragging());
  spaceMapViewport.addEventListener("lostpointercapture", stopMapDragging);
  spaceMapViewport.addEventListener(
    "click",
    (event) => {
      if (!suppressMapClick || event.detail === 0) return;
      suppressMapClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
}

const spaceHousing = createSpaceHousing({
  canSave: progressCanBeSaved,
  ownerName: () => currentUserData.nickname || "私",
  ownerId: () => currentUserId,
  onPlacementStart: () => setSpacePanelCollapsed(true),
  onResidentSelect: openResidentProfile,
  onChange(houses, previousWrite) {
    const uid = currentUserId;
    const version = sessionVersion;
    const fields = {
      spaceHouses: houses,
      houseLocation: houseLocation(houses[0]),
    };
    currentUserData = { ...currentUserData, ...fields };
    if (pendingGuestDocData)
      pendingGuestDocData = { ...pendingGuestDocData, ...fields };
    if (!progressCanBeSaved()) return Promise.resolve();
    writeProfileCache(uid, currentUserData);
    // Serialize complete layouts so a slow earlier write cannot replace a later edit.
    return previousWrite.then(async () => {
      if (version !== sessionVersion || uid !== currentUserId) return;
      await setDoc(doc(db, "users", uid), fields, { merge: true });
    });
  },
});

const toggleSpacePanel = document.getElementById("toggle-space-panel");
const spaceRightPanel = document.getElementById("space-right-panel");
const SPACE_PANEL_PREF_KEY = "deepys-space-panel-collapsed";

function setSpacePanelCollapsed(collapsed) {
  if (collapsed && spaceRightPanel.contains(document.activeElement))
    toggleSpacePanel.focus();
  spaceViewContent.classList.toggle("is-panel-collapsed", collapsed);
  spaceRightPanel.hidden = collapsed;
  toggleSpacePanel.setAttribute("aria-expanded", String(!collapsed));
  const label = collapsed ? "右パネルを開く" : "右パネルを閉じる";
  toggleSpacePanel.setAttribute("aria-label", label);
  toggleSpacePanel.title = label;
  toggleSpacePanel.querySelector(".space-panel-toggle-icon").textContent =
    collapsed ? "‹" : "›";
  toggleSpacePanel.querySelector(".space-panel-toggle-label").textContent =
    collapsed ? "開く" : "閉じる";
  requestAnimationFrame(updateMapScrollbar);
}

let savedPanelCollapsed = window.matchMedia("(max-width: 950px)").matches;
try {
  const preference = localStorage.getItem(SPACE_PANEL_PREF_KEY);
  if (preference !== null) savedPanelCollapsed = preference === "1";
} catch {
  /* Use the default layout. */
}
setSpacePanelCollapsed(savedPanelCollapsed);
toggleSpacePanel.addEventListener("click", () => {
  const collapsed = !spaceRightPanel.hidden;
  setSpacePanelCollapsed(collapsed);
  try {
    localStorage.setItem(SPACE_PANEL_PREF_KEY, collapsed ? "1" : "0");
  } catch {
    /* The panel still works without storage. */
  }
});

function returningFromSindan() {
  let skip = window.__deepysSkipDescent === true;
  try {
    if (
      sessionStorage.getItem("deepys-from-sindan") === "1" ||
      sessionStorage.getItem("deepys-skip-descent") === "1"
    ) {
      skip = true;
    }
    sessionStorage.removeItem("deepys-from-sindan");
    sessionStorage.removeItem("deepys-skip-descent");
  } catch {
    /* 保存が読めないときは、URL の印だけを見る。 */
  }
  if (new URLSearchParams(location.search).get("from") === "sindan") {
    skip = true;
    const url = new URL(location.href);
    url.searchParams.delete("from");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
  window.__deepysSkipDescent = false;
  return skip;
}

async function restoreAccountSession() {
  await authReady;
  const user = auth.currentUser;
  const skipDescent = returningFromSindan();
  if (!user || user.isAnonymous) {
    cancelDescent();
    return;
  }
  if (skipDescent) {
    cancelDescent();
    const version = sessionVersion;
    const profile = await loadAccountProfile(user);
    if (version !== sessionVersion || auth.currentUser?.uid !== user.uid)
      return;
    currentUserData = createBlankUserData();
    rememberAndEnter(user, profile);
    return;
  }
  const token = beginDescent();
  const version = sessionVersion;
  try {
    const [profile] = await Promise.all([
      loadAccountProfile(user),
      waitForDescent(),
    ]);
    if (
      token !== descentGeneration ||
      version !== sessionVersion ||
      auth.currentUser?.uid !== user.uid
    ) {
      if (token === descentGeneration) cancelDescent();
      return;
    }
    currentUserData = createBlankUserData();
    rememberAndEnter(user, profile);
    await finishDescent();
  } catch (error) {
    if (token === descentGeneration) cancelDescent();
    throw error;
  }
}

function googleAuthMessage(text) {
  document.querySelectorAll(".google-auth-message").forEach((element) => {
    element.textContent = text;
  });
}

async function signInWithGoogle() {
  const buttons = document.querySelectorAll("[data-google-login]");
  buttons.forEach((button) => {
    button.disabled = true;
  });
  googleAuthMessage("Google に接続しています…");
  const version = ++sessionVersion;
  try {
    await authReady;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    let result;
    let guestProfile = null;
    if (auth.currentUser?.isAnonymous) {
      const progress = { ...currentUserData };
      try {
        result = await linkWithPopup(auth.currentUser, provider);
        guestProfile = progress;
      } catch (error) {
        // An existing Google account keeps its own saved home and progress.
        if (error.code !== "auth/credential-already-in-use") throw error;
        const credential = GoogleAuthProvider.credentialFromError(error);
        if (!credential) throw error;
        result = await signInWithCredential(auth, credential);
      }
    } else {
      result = await signInWithPopup(auth, provider);
    }
    const user = result.user;
    const snapshot = await getDoc(doc(db, "users", user.uid));
    if (version !== sessionVersion || auth.currentUser?.uid !== user.uid)
      return;
    const saved = snapshot.exists() ? snapshot.data() : null;
    const guestAvatar = guestProfile && {
      avatar: avatarPresetKey(guestProfile.avatar),
      avatarImage: guestProfile.avatarImage ?? null,
    };
    const profile = {
      ...createBlankUserData(),
      ...(saved || guestProfile || {}),
      ...guestAvatar,
      nickname:
        savedNickname(saved) ||
        savedNickname(guestProfile) ||
        user.displayName ||
        "地底の住人",
    };
    if (!snapshot.exists()) {
      await setDoc(
        doc(db, "users", user.uid),
        {
          ...profile,
          spaceHouses: normalizeSpaceHouses(profile.spaceHouses),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
    } else if (
      guestAvatar &&
      (guestAvatar.avatar !== saved.avatar ||
        guestAvatar.avatarImage !== (saved.avatarImage ?? null))
    ) {
      await setDoc(doc(db, "users", user.uid), guestAvatar, { merge: true });
    }
    if (version !== sessionVersion || auth.currentUser?.uid !== user.uid)
      return;
    guestUserPromise = null;
    profilePrefetch = null;
    profilePrefetchUid = null;
    currentUserData = createBlankUserData();
    registerModal.hidden = true;
    await enterAfterLogin(user, profile);
    googleAuthMessage("");
  } catch (error) {
    console.warn("Google ログインに失敗:", error);
    const messages = {
      "auth/popup-closed-by-user":
        "ログインをキャンセルしました。もう一度試せます。",
      "auth/cancelled-popup-request":
        "別のログイン画面が開いています。そちらで続けてね。",
      "auth/popup-blocked":
        "ポップアップを許可してから、もう一度 Google ログインを押してね。",
      "auth/operation-not-allowed":
        "Google ログインの設定がまだ有効になっていません。管理者は Firebase の Authentication で Google を有効にしてください。",
      "auth/unauthorized-domain":
        "このサイトのドメインが未登録です。Firebase の Authentication → 設定 → 承認済みドメインに追加してください。",
      "auth/account-exists-with-different-credential":
        "このメールのアカウントがすでにあります。メールとパスワードでログインしてください。",
      "auth/network-request-failed":
        "通信できませんでした。接続を確認して、もう一度試してね。",
    };
    googleAuthMessage(
      messages[error.code] ||
        "ログインを完了できませんでした。もう一度試してね。",
    );
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

document.querySelectorAll("[data-google-login]").forEach((button) => {
  button.addEventListener("click", signInWithGoogle);
});

// Other tabs may log out this account; stop showing its private local state too.
onAuthStateChanged(auth, (user) => {
  if (!user && currentUserId) {
    sessionVersion += 1;
    stopCamera();
    clearProfileCache();
    resetPlayMemory();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    returnToTop();
  }
});

restoreAccountSession().catch((error) => {
  console.warn("ログイン状態の復元に失敗:", error);
  showScreen(firstView);
  cancelDescent();
  googleAuthMessage(
    "接続を確認してください。ログイン状態の読み込みを再試行できます。",
  );
});

// フレーム付き写真の共有
// 写真の共有専用。RESTを使い、オフライン時にアップロードを保留しない。

const photoShareOptions = db.app.options;
const photoShareEndpoint = `https://firestore.googleapis.com/v1/projects/${photoShareOptions.projectId}/databases/(default)/documents/photoShares`;
const MAX_DATA_URL_LENGTH = 900000;
const SHARE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const PHOTO_DATA = /^data:image\/(png|webp);base64,[A-Za-z0-9+/]+=*$/;

async function requestSharedPhoto(url, init) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.any([init.signal, AbortSignal.timeout(20000)]),
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(
      body.error?.message || "写真を取得できませんでした。",
    );
    error.code = body.error?.status;
    throw error;
  }
  return body;
}

async function prepareSharedPhoto(source) {
  if (source.length <= MAX_DATA_URL_LENGTH && PHOTO_DATA.test(source))
    return source;
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  // WebPは角丸写真の透明部分も保持する。元のPNGダウンロードは変更しない。
  for (const scale of [1, 0.8, 0.6]) {
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.94, 0.85, 0.75]) {
      const data = canvas.toDataURL("image/webp", quality);
      if (data.length <= MAX_DATA_URL_LENGTH && PHOTO_DATA.test(data))
        return data;
    }
  }
  throw new Error(
    "写真のサイズを小さくできませんでした。ダウンロードで保存してね。",
  );
}

async function createPhotoShare(source, signal) {
  const user = auth.currentUser;
  if (!user) throw new Error("通信を確認して、もう一度試してね。");
  const dataUrl = await prepareSharedPhoto(source);
  const token = await user.getIdToken();
  signal.throwIfAborted();
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const expiresAt = new Date(Date.now() + SHARE_LIFETIME_MS);
  await requestSharedPhoto(
    `${photoShareEndpoint}?documentId=${id}&key=${photoShareOptions.apiKey}`,
    {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          ownerUid: { stringValue: user.uid },
          dataUrl: { stringValue: dataUrl },
          expiresAt: { timestampValue: expiresAt.toISOString() },
        },
      }),
    },
  );
  return id;
}

function setupPhotoSharing() {
  const qr = document.getElementById("photo-share-qr");
  const link = document.getElementById("photo-share-link");
  let upload = null;

  function reset() {
    upload?.abort();
    upload = null;
    qr.removeAttribute("src");
    link.hidden = true;
    link.removeAttribute("href");
  }

  async function show(source) {
    reset();
    if (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return;
    upload = new AbortController();
    const { signal } = upload;
    try {
      const { default: qrcode } =
        await import("https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.mjs");
      if (signal.aborted) return;
      const id = await createPhotoShare(source, signal);
      if (signal.aborted) return;
      const url = new URL("/api/photo", location.origin);
      url.searchParams.set("id", id);
      const code = qrcode(0, "M");
      code.addData(url.href, "Byte");
      code.make();
      qr.src = code.createDataURL(4, 16);
      link.href = url.href;
      link.hidden = false;
    } catch (error) {
      if (signal.aborted) return;
      console.error("写真の共有に失敗:", error);
      setCameraMessage(
        "QRコードを作れませんでした。写真はダウンロードできます。",
      );
    } finally {
      if (upload?.signal === signal) upload = null;
    }
  }

  return { reset, show };
}
