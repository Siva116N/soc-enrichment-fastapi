// ==========================================
// TCS SOC - FIREBASE INITIALIZATION
// ==========================================

// 1. Import the required Firebase modules directly from Google's CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. Your web app's Firebase configuration
// ⚠️ REPLACE THIS ENTIRE OBJECT WITH YOUR ACTUAL FIREBASE KEYS ⚠️
const firebaseConfig = {
    apiKey: "AIzaSyD-KHjtm33KZX_S1bgCBzpSQ25pG5f7Lmo",
  authDomain: "ioc-enrich-v2.firebaseapp.com",
  projectId: "ioc-enrich-v2",
  storageBucket: "ioc-enrich-v2.firebasestorage.app",
  messagingSenderId: "519445754169",
  appId: "1:519445754169:web:566e0ddcd9b6475e7bb8e8"
};

// 3. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 4. Initialize Cloud Firestore and export it for use in other files
export const db = getFirestore(app);

console.log("[SYSTEM] Firebase Global Database Initialized.");
