'use client';

import {useEffect, useState} from 'react';
import {studentProgress, studentWorkState, type StudentWork} from '../../lib/student-foundation';
import {sakuraMilestones} from '../../lib/student-sakura-progress';

type Term = {id: string; label: string};
type Theme = 'sakura' | 'mint';
type WorkState = ReturnType<typeof studentWorkState>;
type Load<T> = {state: 'loading' | 'error'} | {state: 'ready'; items: T[]};

const workLabels: Record<WorkState, string> = {
  graded: 'ตรวจแล้ว',
  pending: 'ส่งแล้ว รอคะแนน',
  missing: 'ยังไม่ส่ง',
  leave: 'ลา',
  absent: 'ขาด',
  revision: 'อยู่ในช่วงแก้งาน',
  overdue: 'เลยกำหนด',
};
const stageDetails: Record<string, {label: string; flowers: number}> = {
  seed: {label: '🌰 เมล็ดพันธุ์', flowers: 0},
  sprout: {label: '🌱 ต้นอ่อน', flowers: 1},
  blossom: {label: '🌿 กำลังเติบโต', flowers: 3},
  bloom: {label: '🌸 ผลิบาน', flowers: 4},
};
const canopy = [[105, 72], [140, 48], [180, 55], [155, 78]];
const badgeLabels: Record<string, string> = {
  'first-submission': 'ส่งงานครั้งแรก',
  'all-submitted': 'ส่งงานครบ',
  'all-graded': 'ตรวจงานครบ',
};
const dateFormat = new Intl.DateTimeFormat('th-TH', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok'});

export function StudentDashboard({readTerms, readWorks, signOut, theme, setTheme}: {
  readTerms: () => Promise<Term[]>;
  readWorks: (termId: string) => Promise<StudentWork[]>;
  signOut: () => Promise<void>;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}) {
  const [terms, setTerms] = useState<Load<Term>>({state: 'loading'});
  const [termAttempt, setTermAttempt] = useState(0);
  const [termId, setTermId] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  useEffect(() => {
    let current = true;
    readTerms().then((items) => {
      if (!current) return;
      setTerms({state: 'ready', items});
      setTermId(items[0]?.id ?? '');
    }).catch(() => {
      if (current) setTerms({state: 'error'});
    });
    return () => { current = false; };
  }, [readTerms, termAttempt]);

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(false);
    try {
      await signOut();
    } catch {
      setSignOutError(true);
      setSigningOut(false);
    }
  }

  return (
    <>
      <section aria-labelledby="student-term-heading">
        <h2 id="student-term-heading">ผลการเรียนรายภาคเรียน</h2>
        {terms.state === 'loading' && <p role="status">กำลังโหลดภาคเรียน…</p>}
        {terms.state === 'error' && (
          <>
            <p role="alert">โหลดภาคเรียนไม่ได้</p>
            <button type="button" onClick={() => {
              setTerms({state: 'loading'});
              setTermAttempt((attempt) => attempt + 1);
            }}>โหลดภาคเรียนอีกครั้ง</button>
          </>
        )}
        {terms.state === 'ready' && (terms.items.length ? (
          <label>
            ภาคเรียน
            <select value={termId} disabled={signingOut} onChange={(event) => setTermId(event.target.value)}>
              {terms.items.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
            </select>
          </label>
        ) : <p>ยังไม่มีภาคเรียนที่เผยแพร่</p>)}
      </section>
      {!signingOut && termId && <TermResults key={termId} termId={termId} readWorks={readWorks} />}
      <section id="student-profile" aria-labelledby="student-profile-heading">
        <h2 id="student-profile-heading">บัญชีและธีม</h2>
        <label>
          ธีม
          <select value={theme} onChange={(event) => setTheme(event.target.value === 'mint' ? 'mint' : 'sakura')}>
            <option value="sakura">Sakura</option>
            <option value="mint">Mint</option>
          </select>
        </label>
        {signOutError && <p role="alert">ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง</p>}
        <button type="button" disabled={signingOut} onClick={logout}>
          {signingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
        </button>
      </section>
      <nav className="student-nav" aria-label="เมนูนักเรียน">
        <a href="#student-overview"><span aria-hidden="true">⌂</span>หน้าหลัก</a>
        {!signingOut && termId && <>
          <a href="#student-works"><span aria-hidden="true">▤</span>งานของฉัน</a>
          <a href="#student-calendar"><span aria-hidden="true">▦</span>กำหนดส่ง</a>
        </>}
        <a href="#student-profile"><span aria-hidden="true">◎</span>บัญชี</a>
      </nav>
    </>
  );
}

function TermResults({termId, readWorks}: {termId: string; readWorks: (termId: string) => Promise<StudentWork[]>}) {
  const [works, setWorks] = useState<Load<StudentWork>>({state: 'loading'});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    readWorks(termId).then((items) => {
      if (current) setWorks({state: 'ready', items});
    }).catch(() => {
      if (current) setWorks({state: 'error'});
    });
    return () => { current = false; };
  }, [readWorks, termId, attempt]);

  return (
    <>
      {works.state === 'ready' && <TermSummary works={works.items} />}
      <section id="student-works" aria-labelledby="student-works-heading">
        <h2 id="student-works-heading">งานของฉัน</h2>
        {works.state === 'loading' && <p role="status">กำลังโหลดงาน…</p>}
        {works.state === 'error' && (
          <>
            <p role="alert">โหลดงานไม่ได้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลโรงเรียน</p>
            <button type="button" onClick={() => {
              setWorks({state: 'loading'});
              setAttempt((previous) => previous + 1);
            }}>โหลดงานอีกครั้ง</button>
          </>
        )}
        {works.state === 'ready' && <WorkList works={works.items} />}
      </section>
      <section id="student-calendar" aria-labelledby="student-calendar-heading">
        <h2 id="student-calendar-heading">กำหนดส่งและแก้งาน</h2>
        {works.state === 'ready' ? <DeadlineAgenda works={works.items} /> : <p>กำหนดส่งจะแสดงเมื่อโหลดงานสำเร็จ</p>}
      </section>
    </>
  );
}

function TermSummary({works}: {works: StudentWork[]}) {
  const progress = studentProgress(works);
  const sakura = sakuraMilestones(works);
  const stage = stageDetails[sakura.stage];
  const metrics = [
    [progress.total, 'งานทั้งหมด'],
    [progress.submitted, 'ส่งแล้ว'],
    [progress.outstanding, 'งานค้าง'],
    [sakura.graded ? progress.points + ' / ' + progress.possible : '—', 'คะแนนที่ตรวจแล้ว'],
  ] as const;

  return (
    <>
      <section className="student-metrics" aria-label="ภาพรวมงาน">
        {metrics.map(([value, label]) => <div key={label}><strong>{value}</strong><small>{label}</small></div>)}
      </section>
      <section className="student-champion" aria-labelledby="student-champion-heading">
        <h2 id="student-champion-heading">Sakura Champions</h2>
        <svg className="student-tree-art" viewBox="0 0 280 150" aria-hidden="true">
          <ellipse cx="140" cy="138" rx="65" ry="7" fill="#dcebdc" />
          <path d="M140 137 Q147 100 140 55 M143 103 L105 75 M143 88 L180 55" stroke="#987765" strokeWidth="8"
            strokeLinecap="round" fill="none" />
          {canopy.map(([x, y], index) => (
            <g key={x} className="student-blossom">
              <circle cx={x} cy={y} r="24" fill={index < stage.flowers ? '#efacc9' : '#d5e9d4'} />
              {index < stage.flowers && <text x={x} y={y + 6} textAnchor="middle" fill="#fff" fontSize="22">✿</text>}
            </g>
          ))}
        </svg>
        <h3>{stage.label}</h3>
        <p>ส่งงานแล้ว {progress.submitted} จาก {progress.total} งาน</p>
        <progress aria-label="สัดส่วนงานที่ส่งแล้ว" max={Math.max(1, progress.total)} value={progress.submitted} />
        <p>ตรวจแล้ว {sakura.graded} งาน</p>
        {sakura.badges.length > 0 && (
          <ul className="student-portal-badges">
            {sakura.badges.map((badge) => <li key={badge}>🏅 {badgeLabels[badge]}</li>)}
          </ul>
        )}
      </section>
    </>
  );
}

function WorkList({works}: {works: StudentWork[]}) {
  const [course, setCourse] = useState('');
  const [status, setStatus] = useState('');
  const now = Date.now();
  const courses = [...new Set(works.map((work) => work.course))].sort((a, b) => a.localeCompare(b, 'th'));
  const visible = works.map((work): {work: StudentWork; state: WorkState} => ({work, state: studentWorkState(work, now)}))
    .filter(({work, state}) => (!course || work.course === course) && (!status || state === status));

  if (!works.length) return <p>ไม่พบงานในภาคเรียนนี้</p>;

  return (
    <>
      <div className="student-portal-filters">
        <label>
          รายวิชา
          <select value={course} onChange={(event) => setCourse(event.target.value)}>
            <option value="">ทุกวิชา</option>
            {courses.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          สถานะงาน
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">ทุกสถานะ</option>
            {Object.entries(workLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <p role="status">พบ {visible.length} จาก {works.length} งาน</p>
      {visible.length === 0 && <p>ไม่มีงานที่ตรงกับตัวกรอง</p>}
      {visible.map(({work, state}) => (
        <article key={work.id}>
          <small>{work.course}</small>
          <h3>{work.title}</h3>
          <span className="student-status" data-state={state}>{workLabels[state]}</span>
          <p>คะแนน {work.score ?? '—'} / {work.maxScore}</p>
          {work.deadline !== null && <small>ส่งงาน {dateFormat.format(work.deadline)}</small>}
          {work.revisionDeadline !== null && <small>แก้งาน {dateFormat.format(work.revisionDeadline)}</small>}
        </article>
      ))}
    </>
  );
}

function DeadlineAgenda({works}: {works: StudentWork[]}) {
  const events = works.flatMap((work) => {
    const deadlines = [];
    if (work.deadline !== null) deadlines.push({key: work.id + '-due', work, label: 'ส่งงาน', date: work.deadline});
    if (work.revisionDeadline !== null) deadlines.push({key: work.id + '-revision', work, label: 'แก้งาน', date: work.revisionDeadline});
    return deadlines;
  }).sort((a, b) => a.date - b.date);

  if (!events.length) return <p>ไม่มีวันกำหนดส่งหรือแก้งานในภาคเรียนนี้</p>;

  return (
    <ul className="student-calendar">
      {events.map((event) => (
        <li key={event.key}>
          <time dateTime={new Date(event.date).toISOString()}>{dateFormat.format(event.date)}</time>
          {' · '}{event.label}
          <strong>{event.work.title}</strong>
          <small>{event.work.course}</small>
        </li>
      ))}
    </ul>
  );
}
