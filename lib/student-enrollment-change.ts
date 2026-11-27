import {parseStudentMembershipWindows, type StudentMembershipWindow} from './student-membership-windows.ts';

export type StudentEnrollmentChange = {
  action: 'transfer' | 'promote';
  studentId: string;
  sourceTermId: string;
  sourceRoomId: string;
  targetTermId: string;
  targetRoomId: string;
  effectiveAt: number;
  operationId: string;
};

export const validEnrollmentId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

export function parseEnrollmentChange(value: unknown, now: number): StudentEnrollmentChange | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const {
    action, studentId, sourceTermId, sourceRoomId, targetTermId, targetRoomId, effectiveAt, operationId,
  } = value as Record<string, unknown>;
  if (Object.keys(value).length !== 8 || (action !== 'transfer' && action !== 'promote') ||
      !validEnrollmentId(studentId) || !validEnrollmentId(sourceTermId) || !validEnrollmentId(sourceRoomId) ||
      !validEnrollmentId(targetTermId) || !validEnrollmentId(targetRoomId) ||
      !validEnrollmentId(operationId) || typeof effectiveAt !== 'number' ||
      !Number.isSafeInteger(effectiveAt) || effectiveAt < 1 || effectiveAt > now) return null;
  if (action === 'transfer'
    ? sourceTermId !== targetTermId || sourceRoomId === targetRoomId
    : sourceTermId === targetTermId) return null;
  return {action, studentId, sourceTermId, sourceRoomId, targetTermId, targetRoomId, effectiveAt, operationId};
}

export function closeStudentMembership(previous: StudentMembershipWindow[] | null, effectiveAt: number) {
  // An existing active roster without explicit windows used the entire course before this transition.
  if (previous === null) return [{from: 0, until: effectiveAt}];
  const last = previous.at(-1);
  if (!last || last.until !== null || last.from >= effectiveAt) return null;
  return [...previous.slice(0, -1), {from: last.from, until: effectiveAt}];
}

export function openStudentMembership(previous: StudentMembershipWindow[] | null, effectiveAt: number) {
  const last = previous?.at(-1);
  if (last && (last.until === null || last.until > effectiveAt)) return null;
  return parseStudentMembershipWindows([...(previous ?? []), {from: effectiveAt, until: null}]);
}
