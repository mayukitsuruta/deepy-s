import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// ① Authenticationを追加
// IndexedDBの復元待ちで画面が止まるのを避けるため、localStorageに保存する
import {
  browserLocalPersistence,
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

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// Cloud Firestore
export const db = getFirestore(app);

// ② Authenticationを使えるようにする
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
});
