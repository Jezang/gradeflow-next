import {initializeApp, getApps, type FirebaseApp} from 'firebase/app';
import {connectAuthEmulator, getAuth, initializeAuth, inMemoryPersistence} from 'firebase/auth';
import {connectFirestoreEmulator, getFirestore} from 'firebase/firestore';
import {firebaseMode, firebaseWebConfig} from './firebase-target';

function firebaseApp(name: string): {app: FirebaseApp; created: boolean} {
  const config = firebaseWebConfig();
  const existing = getApps().find(candidate => candidate.name === name);
  if (existing) {
    const {projectId, apiKey, authDomain, appId} = existing.options;
    if (projectId !== config.projectId || apiKey !== config.apiKey ||
        authDomain !== config.authDomain || appId !== config.appId) throw Error('Firebase browser project mismatch');
    return {app: existing, created: false};
  }
  return {app: initializeApp(config, name), created: true};
}

function services(name: string, inMemory = false) {
  const {app, created} = firebaseApp(name);
  const auth = created && inMemory ? initializeAuth(app, {persistence: inMemoryPersistence}) : getAuth(app);
  const db = getFirestore(app);
  if (created && firebaseMode === 'emulator') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return {auth, db};
}

export function firebaseServices() {
  return services('[DEFAULT]');
}

export function portalAuth() {
  return services('gradeflow-portal', true).auth;
}

export function studentAuth() {
  return services('gradeflow-student', true).auth;
}
