const vercelEnvironment = process.env.VERCEL === '1' ? process.env.VERCEL_ENV : undefined;
const mode = vercelEnvironment === 'preview' ? 'preview'
  : vercelEnvironment === 'production' ? 'production'
  : process.env.VERCEL !== '1' && process.env.NODE_ENV === 'development' &&
      process.env.NEXT_PUBLIC_STUDENT_PORTAL_DEMO_EMULATORS === 'true' ? 'emulator'
  : 'disabled';

export default {
  env: {
    NEXT_PUBLIC_GRADEFLOW_FIREBASE_MODE: mode,
    NEXT_PUBLIC_STUDENT_PORTAL_ENABLED: ['preview', 'emulator'].includes(mode) &&
      process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED === 'true' ? 'true' : 'false',
    NEXT_PUBLIC_STUDENT_PORTAL_ADMIN_ENABLED: ['preview', 'emulator'].includes(mode) &&
      process.env.NEXT_PUBLIC_STUDENT_PORTAL_ADMIN_ENABLED === 'true' ? 'true' : 'false',
  },
};
