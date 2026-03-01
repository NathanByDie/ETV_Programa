import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDmlF4p6fHQ3OCuHD7AikCUvFF_bebiDk4",
  authDomain: "etvdatabase.firebaseapp.com",
  projectId: "etvdatabase",
  storageBucket: "etvdatabase.firebasestorage.app",
  messagingSenderId: "624387202623",
  appId: "1:624387202623:web:4672b91f46f17d06b3228a",
  measurementId: "G-34NYTEN42E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
