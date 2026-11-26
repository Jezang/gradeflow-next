import { firebaseConfig } from '../../../../lib/firebase-config';
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
  return readPortal(request, kind, portalEnabled(kind), firebasePortalSources(firebaseConfig));
}
