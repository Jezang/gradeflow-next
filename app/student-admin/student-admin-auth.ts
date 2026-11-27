import {firebaseServices} from '../../lib/firebase';
import {firebaseMode} from '../../lib/firebase-target';

export const studentAdminDemo = firebaseMode === 'emulator';

export function studentAdminAuth() {
  return firebaseServices().auth;
}
