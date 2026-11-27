import {firebaseConfig} from './firebase-config.ts';

type WebConfig = {projectId: string; apiKey: string; authDomain?: string; appId?: string};
type StagingWebConfig = Partial<WebConfig>;

export const emulatorProject = 'demo-gradeflow';
const projectPattern = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export function selectFirebaseWebConfig(mode: string | undefined, staging: StagingWebConfig): WebConfig {
  if (mode === 'production') return firebaseConfig;
  if (mode === 'emulator') return {projectId: emulatorProject, apiKey: emulatorProject};
  if (mode !== 'preview') throw Error('Firebase is disabled in this environment');

  const {projectId, apiKey, authDomain, appId} = staging;
  if (!projectId || !projectPattern.test(projectId) || projectId.startsWith('demo-') ||
      projectId === firebaseConfig.projectId || authDomain !== projectId + '.firebaseapp.com' ||
      !apiKey || !/^AIza[A-Za-z0-9_-]{35}$/.test(apiKey) || apiKey === firebaseConfig.apiKey ||
      !appId || !/^1:\d+:web:[a-f0-9]+$/.test(appId) ||
      appId.split(':')[1] === firebaseConfig.messagingSenderId) {
    throw Error('Invalid staging Firebase web configuration');
  }
  return {projectId, apiKey, authDomain, appId};
}

function loopback(value: string | undefined) {
  const port = /^127\.0\.0\.1:([1-9]\d{0,4})$/.exec(value ?? '')?.[1];
  return port !== undefined && Number(port) <= 65535;
}

export function validateStudentFirebaseTarget(
  mode: string | undefined, browserProject: string, serverProject: string | undefined,
  authEmulator?: string, dbEmulator?: string,
) {
  if (serverProject !== browserProject) throw Error('Student Firebase projects must match');
  if (mode === 'emulator' && serverProject === emulatorProject && loopback(authEmulator) && loopback(dbEmulator)) {
    return serverProject;
  }
  if (mode === 'preview' && projectPattern.test(serverProject) && serverProject !== firebaseConfig.projectId &&
      !serverProject.startsWith('demo-') && !authEmulator && !dbEmulator) return serverProject;
  throw Error('Student Firebase target is unavailable');
}

export function readStagingServiceAccount(value: string | undefined, projectId: string) {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(value ?? '');
  } catch {
    throw Error('Missing staging Firebase credentials');
  }
  const {project_id, client_email, private_key, type} = parsed ?? {};
  if (type !== 'service_account' || project_id !== projectId ||
      typeof client_email !== 'string' || !client_email.endsWith('@' + projectId + '.iam.gserviceaccount.com') ||
      typeof private_key !== 'string' || !private_key.startsWith('-----BEGIN PRIVATE KEY-----')) {
    throw Error('Staging Firebase credentials must match the staging project');
  }
  return {projectId, clientEmail: client_email, privateKey: private_key};
}
