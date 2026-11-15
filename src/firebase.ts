import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "SEU_FIREBASE_API_KEY",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "SEU-PROJETO-ID.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "SEU-PROJETO-ID",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "SEU-PROJETO-ID.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "SEU_MESSAGING_SENDER_ID",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "SEU_FIREBASE_APP_ID",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "SEU_MEASUREMENT_ID"
};

const app = initializeApp(firebaseConfig);
export const analytics = isSupported().then((supported) => supported ? getAnalytics(app) : null);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Modo de teste local (`npm run eventos:local`): banco e login rodam nos
 * emuladores do Firebase no próprio computador — nada é gravado em produção.
 */
export const MODO_EMULADOR = import.meta.env.VITE_USE_EMULATORS === 'true';

if (MODO_EMULADOR) {
    connectFirestoreEmulator(db, '127.0.0.1', 8089);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const selo = () => {
        if (document.getElementById('selo-modo-teste')) return;
        const el = document.createElement('div');
        el.id = 'selo-modo-teste';
        el.textContent = 'MODO TESTE LOCAL — dados fictícios';
        el.style.cssText = 'position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:2147483646;background:#f4c20d;color:#3a2600;font:800 11px sans-serif;padding:5px 12px;border-radius:999px;box-shadow:0 4px 12px rgba(0,0,0,.25);pointer-events:none;letter-spacing:.4px';
        document.body.appendChild(el);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', selo); else selo();
}
export default app;
