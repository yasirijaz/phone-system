// This file is no longer used for authentication but may be used for other Firebase services in the future.
// If you are not using any other Firebase services, you can delete this file.
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

const isFirebaseInitialized = (): boolean => {
    return getApps().length > 0;
}

try {
    if (!isFirebaseInitialized()) {
        if (firebaseConfig.apiKey) {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
        }
    } else {
        app = getApp();
        auth = getAuth(app);
    }
} catch (e) {
    console.error("Firebase initialization failed. Please ensure your Firebase environment variables are set correctly if you intend to use Firebase services.", e);
}


export { app, auth, isFirebaseInitialized };
