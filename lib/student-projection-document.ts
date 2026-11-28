import type {StudentWork} from './student-foundation';

export function validStudentProjectionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function validStudentProjectionLabel(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 160 && value.trim().length > 0;
}

function projectionDate(value: unknown): number | null {
  if (value === null || (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 8.64e15)) return value;
  throw new Error('Invalid projection date');
}

export function parseStudentProjectionWork(id: string, data: Record<string, unknown>): StudentWork {
  const {title, course, subjectName, maxScore, score, submitted, attendance} = data;
  if (!validStudentProjectionId(id) || (data.id !== undefined && data.id !== id)
    || !validStudentProjectionLabel(title) || !validStudentProjectionLabel(course)
    || (subjectName !== undefined && !validStudentProjectionLabel(subjectName))
    || typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000
    || typeof submitted !== 'boolean'
    || (score !== null && (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > maxScore || !submitted))
    || (attendance !== undefined && (submitted || (attendance !== 'leave' && attendance !== 'absent')))) {
    throw new Error('Invalid student work projection');
  }
  return {
    id, title, course, maxScore, score, submitted,
    ...(subjectName===undefined?{}:{subjectName}),
    ...(attendance === undefined ? {} : {attendance}),
    deadline: projectionDate(data.deadline),
    revisionDeadline: projectionDate(data.revisionDeadline),
  };
}
