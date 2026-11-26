import type { PortalKind } from './portal-release-policy';

export type PortalResult = {
  course: string;
  assessment: string;
  score: number | null;
  maxScore: number;
  studentId?: string;
  studentName?: string;
};

export type PortalSources = {
  verifyIdentity: (token: string) => Promise<string | null>;
  readProjection: (uid: string, token: string) => Promise<unknown>;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function label(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160;
}

function response(body: object, status: number) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'Vary': 'Authorization',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function visibleResults(projection: Record<string, unknown>, kind: PortalKind): PortalResult[] {
  const rows: unknown[] = Array.isArray(projection.results) ? projection.results : [];
  const scopes: unknown[] = Array.isArray(projection.scopes) ? projection.scopes : [];
  const results: PortalResult[] = [];

  for (const value of rows) {
    const row = record(value);
    if (row?.published !== true || !label(row.studentId) || !label(row.course) || !label(row.assessment)) {
      continue;
    }
    if (typeof row.maxScore !== 'number' || !Number.isFinite(row.maxScore) || row.maxScore <= 0) {
      continue;
    }
    if (row.score !== null && (typeof row.score !== 'number' || !Number.isFinite(row.score) || row.score < 0 || row.score > row.maxScore)) {
      continue;
    }

    const item = { course: row.course, assessment: row.assessment, score: row.score, maxScore: row.maxScore };
    if (kind === 'student') {
      if (row.studentId === projection.studentId) results.push(item);
      continue;
    }

    if (!label(row.roomId) || !label(row.courseId) || !label(row.studentName)) continue;
    const assigned = scopes.some((scope) => {
      const assignment = record(scope);
      return assignment?.roomId === row.roomId && assignment?.courseId === row.courseId;
    });
    if (assigned) results.push({ ...item, studentId: row.studentId, studentName: row.studentName });
  }
  return results;
}

export async function readPortal(request: Request, kind: PortalKind, enabled: boolean, sources: PortalSources) {
  if (!enabled) return response({ error: 'พอร์ทัลยังไม่เปิดให้บริการ' }, 503);
  if (request.method !== 'GET') return response({ error: 'พอร์ทัลนี้เปิดให้อ่านข้อมูลเท่านั้น' }, 405);

  const authorization = request.headers.get('authorization');
  if (!authorization || authorization.length > 8192 || !/^Bearer [A-Za-z0-9._~+\/-]+=*$/.test(authorization)) {
    return response({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
  }
  const token = authorization.slice(7);

  try {
    const uid = await sources.verifyIdentity(token);
    if (!uid) return response({ error: 'กรุณาเข้าสู่ระบบ' }, 401);

    const projection = record(await sources.readProjection(uid, token));
    if (projection?.uid !== uid || projection.active !== true || projection.role !== kind) {
      return response({ error: 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงพอร์ทัล' }, 403);
    }
    if ((kind === 'student' && !label(projection.studentId)) ||
        (kind === 'advisor' && (!Array.isArray(projection.scopes) || !projection.scopes.length))) {
      return response({ error: 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงพอร์ทัล' }, 403);
    }

    return response({ results: visibleResults(projection, kind) }, 200);
  } catch {
    return response({ error: 'ไม่สามารถโหลดข้อมูลได้ในขณะนี้' }, 503);
  }
}
