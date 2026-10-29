import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// ① Authenticationを追加
// ページを離れたり閉じたりしたあとに、前の人のログインが残らないようにメモリだけに置く
import {
  inMemoryPersistence,
  initializeAuth,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

// Firebaseの設定
const firebaseConfig = {
  apiKey: "AIzaSyCp3HVIssPCBT0ViteFH_nGQMj0Y3YBZJA",
  authDomain: "deepy-s.firebaseapp.com",
  projectId: "deepy-s",
  storageBucket: "deepy-s.firebasestorage.app",
  messagingSenderId: "1058398738632",
  appId: "1:1058398738632:web:0637c075204fc6cea96dfd",
  measurementId: "G-FGM19MX5PE",
};

function clearLegacyAuthStorage() {
  const removeFirebaseKeys = (storage) => {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith("firebase:")) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  };

  try {
    removeFirebaseKeys(localStorage);
  } catch {
    // この端末ではログイン情報を消せない。メモリ上のセッションだけを使う
  }
  try {
    removeFirebaseKeys(sessionStorage);
  } catch {
    // この端末ではログイン情報を消せない。メモリ上のセッションだけを使う
  }
  try {
    indexedDB.deleteDatabase("firebaseLocalStorageDb");
  } catch {
    // IndexedDBがない環境では、残っているログイン情報はない
  }
}

// 以前のブラウザ保存ログインを消してから初期化する
clearLegacyAuthStorage();

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// Cloud Firestore
export const db = getFirestore(app);

// ② Authenticationを使えるようにする
export const auth = initializeAuth(app, {
  persistence: inMemoryPersistence,
});
