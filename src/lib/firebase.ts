import { initializeApp } from "firebase/app";
import { getFirestore, setLogLevel, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Suppress benign warnings about clock skew
setLogLevel('error');

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

// Initialize Firestore
export const db = getFirestore(app);

// Enable persistence (older but more compatible way)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
  } else if (err.code === 'unimplemented') {
    console.warn('The current browser does not support all of the features required to enable persistence');
  }
});

export const storage = getStorage(app);
export const auth = getAuth(app);
