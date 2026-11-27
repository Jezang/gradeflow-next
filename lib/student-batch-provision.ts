import {issueStudentCredential, type StudentCredentialBackend} from './student-credential-service.ts';
import {planStudentProvision} from './student-provision-plan.ts';

export const studentBatchSize = 10;

export function parseStudentBatch(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > studentBatchSize ||
      value.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) ||
      new Set(value).size !== value.length) return null;
  return value;
}

export async function provisionStudentBatch(backend: StudentCredentialBackend, token: string, studentIds: string[]) {
  const rows = await Promise.all(studentIds.map(async studentId => ({
    studentId, studentNumber: await backend.readStudentNumber(studentId), active: true,
  })));
  const plans = planStudentProvision(rows);
  const results = [];
  for (const {studentId} of plans) {
    try {
      const credential = await issueStudentCredential(backend, token, {studentId, action: 'provision'});
      results.push({studentId, status: 'issued' as const, ...credential});
    } catch {
      results.push({studentId, status: 'unavailable' as const});
    }
  }
  return results;
}
