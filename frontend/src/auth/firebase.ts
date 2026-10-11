/**
 * Optional Firebase Authentication (Google sign-in). The SDK is loaded from Google's CDN only when
 * VITE_FIREBASE_API_KEY / VITE_FIREBASE_AUTH_DOMAIN / VITE_FIREBASE_PROJECT_ID are set at build time.
 * The resulting ID token is verified server-side (POST /api/auth/firebase) and exchanged for a MedTrust session.
 */
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2'

export const firebaseClientConfigured = !!(cfg.apiKey && cfg.authDomain && cfg.projectId)

export async function firebaseGoogleIdToken(): Promise<string> {
  if (!firebaseClientConfigured) throw new Error('Firebase is not configured in this build')
  const app = await import(/* @vite-ignore */ `${SDK}/firebase-app.js`)
  const auth = await import(/* @vite-ignore */ `${SDK}/firebase-auth.js`)
  const fb = app.getApps().length ? app.getApp() : app.initializeApp(cfg)
  const a = auth.getAuth(fb)
  const cred = await auth.signInWithPopup(a, new auth.GoogleAuthProvider())
  return cred.user.getIdToken()
}
