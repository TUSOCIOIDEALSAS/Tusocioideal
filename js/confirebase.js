// js/confirebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔹 Configuración de tu proyecto Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD2HVTonSbPFYHkmsDsggJGymD5riNZIhk",
    authDomain: "paginaweb-a122f.firebaseapp.com",
    projectId: "paginaweb-a122f",
    storageBucket: "paginaweb-a122f.firebasestorage.app",
    messagingSenderId: "649932370596",
    appId: "1:649932370596:web:6340cfad7d66383d09ec31"
  };

// 🔹 Inicializa Firebase y Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
