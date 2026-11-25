import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// Firebase Web configuration is public; authorization is enforced by Auth and Rules.
const config = {apiKey:"AIzaSyBoUzP1DbEYytgib3woPHg1HDeoHrt6vuo",authDomain:"gradeflow-next.firebaseapp.com",projectId:"gradeflow-next",storageBucket:"gradeflow-next.firebasestorage.app",messagingSenderId:"735094755594",appId:"1:735094755594:web:b9f11f4945e86bdc43eaf3"};
export function firebaseServices(){const app=getApps().length?getApp():initializeApp(config);return {auth:getAuth(app),db:getFirestore(app)};}
