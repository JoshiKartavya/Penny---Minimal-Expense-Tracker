import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyB_7jzuo53hB8D319YnkTBYmh9gve9dzc0",
  authDomain: "minimal-expense-tracker-b1d91.firebaseapp.com",
  projectId: "minimal-expense-tracker-b1d91",
  storageBucket: "minimal-expense-tracker-b1d91.firebasestorage.app",
  messagingSenderId: "420970137197",
  appId: "1:420970137197:android:b7f6dec2d570b5e8f0a164"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence so users stay logged in
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

export { app, auth, db };
