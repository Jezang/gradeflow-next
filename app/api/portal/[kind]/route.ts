import { firebaseMode, firebaseWebConfig } from '../../../../lib/firebase-target';
import { readPortal } from '../../../../lib/portal-access';
import { firebasePortalSources } from '../../../../lib/portal-firebase';
import { isPortalKind, portalEnabled } from '../../../../lib/portal-release-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isPortalKind(kind)) {
    return Response.json({ error: 'ไม่พบพอร์ทัล' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  if ((firebaseMode !== 'preview' && firebaseMode !== 'production') || !portalEnabled(kind)) {
    return Response.json({ error: 'พอร์ทัลยังไม่เปิดให้บริการ' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    return await readPortal(request, kind, true, firebasePortalSources(firebaseWebConfig()));
  } catch {
    return Response.json({ error: 'พอร์ทัลยังไม่พร้อมใช้งาน' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
