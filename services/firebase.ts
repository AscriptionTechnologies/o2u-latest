import {
  FirebaseOptions,
  getApp,
  getApps,
  initializeApp,
} from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  type Firestore,
  CACHE_SIZE_UNLIMITED,
  persistentLocalCache,
} from 'firebase/firestore';

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDYKThnuvvX23-C8VbPX1X91UBl0DHcwOY",
  authDomain: "only2u-97cf1.firebaseapp.com",
  projectId: "only2u-97cf1",
  storageBucket: "only2u-97cf1.firebasestorage.app",
  messagingSenderId: "886462856389",
  appId: "1:886462856389:web:534b05978d2fea73c6c4ac",
  measurementId: "G-RKQNQ6SEB8"
};



const ensureConfigValue = (key: keyof FirebaseOptions) => {
  const value = firebaseConfig[key];
  if (!value) {
    console.warn(`[Firebase] Missing configuration for ${key}. Set EXPO_PUBLIC_FIREBASE_* env vars.`);
  }
  return value;
};



// Validate required config values at runtime (non-blocking in dev)
ensureConfigValue('apiKey');
ensureConfigValue('projectId');
ensureConfigValue('appId');

const createFirebaseApp = () => {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
};

const app = createFirebaseApp();
const auth: Auth = getAuth(app);

const firestore: Firestore = initializeFirestore(app, {
  cache: persistentLocalCache({
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  }),
  experimentalForceLongPolling: true,
});

export { app as firebaseApp, auth as firebaseAuth, firestore as firebaseDb };

