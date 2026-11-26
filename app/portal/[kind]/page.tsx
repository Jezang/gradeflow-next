import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isPortalKind, portalEnabled } from '../../../lib/portal-release-policy';
import PortalSignIn from './sign-in';

export default async function PortalPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isPortalKind(kind)) notFound();
  const title = kind === 'advisor' ? 'พอร์ทัลครูที่ปรึกษา' : 'พอร์ทัลนักเรียน';

  return (
    <main>
      <header>
        <h1>{title}</h1>
        <Link href="/">หน้าหลัก</Link>
      </header>
      {portalEnabled(kind)
        ? <PortalSignIn key={kind} kind={kind} />
        : <section className="panel">
            <h2>ยังไม่เปิดให้บริการ</h2>
            <p>โปรดติดต่อโรงเรียนเพื่อติดตามวันเปิดใช้งาน</p>
          </section>}
    </main>
  );
}
