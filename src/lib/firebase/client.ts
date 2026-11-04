"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const EMULATOR_PROJECT_ID = "demo-shuttle";
export const usingEmulator =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true" || !config.apiKey || !config.projectId;

interface Services {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
}

declare global {
  var __shuttleFirebase: Services | undefined;
}

function createServices(): Services {
  const app =
    getApps()[0] ??
    initializeApp(
      usingEmulator
        ? {
            apiKey: "demo-key",
            authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
            projectId: EMULATOR_PROJECT_ID,
            appId: "demo-app",
          }
        : config,
    );

  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    try {
      db = initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: memoryLocalCache() });
    } catch {
      db = getFirestore(app);
    }
  }

  const auth = getAuth(app);

  if (usingEmulator) {
    const host = process.env.NEXT_PUBLIC_EMULATOR_HOST || window.location.hostname || "127.0.0.1";
    connectAuthEmulator(auth, `http://${host}:9199`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8181);
  }

  return { app, db, auth };
}

export function getFirebase(): Services {
  if (typeof window === "undefined") {
    throw new Error("Firebase is only available in the browser.");
  }
  globalThis.__shuttleFirebase ??= createServices();
  return globalThis.__shuttleFirebase;
}

let authPromise: Promise<User> | null = null;

/** Silently signs this browser in anonymously. Users never see an auth screen. */
export function ensureAuth(): Promise<User> {
  if (authPromise) return authPromise;
  const { auth } = getFirebase();
  authPromise = new Promise<User>((resolve, reject) => {
    const stop = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          stop();
          resolve(user);
        } else {
          signInAnonymously(auth).catch((err) => {
            stop();
            reject(err);
          });
        }
      },
      (err) => {
        stop();
        reject(err);
      },
    );
  }).catch((err) => {
    authPromise = null;
    throw err;
  });
  return authPromise;
}
