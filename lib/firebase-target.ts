import {selectFirebaseWebConfig} from './firebase-environment';

export const firebaseMode = process.env.NEXT_PUBLIC_GRADEFLOW_FIREBASE_MODE;

export function firebaseWebConfig() {
  return selectFirebaseWebConfig(firebaseMode, {
    projectId: process.env.NEXT_PUBLIC_STAGING_FIREBASE_PROJECT_ID,
    apiKey: process.env.NEXT_PUBLIC_STAGING_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_STAGING_FIREBASE_AUTH_DOMAIN,
    appId: process.env.NEXT_PUBLIC_STAGING_FIREBASE_APP_ID,
  });
}
