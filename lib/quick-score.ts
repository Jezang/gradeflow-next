export type QuickScore = {ok: true; value: number | null} | {ok: false};

export function parseQuickScore(raw: string, maximum: number): QuickScore {
  if (!Number.isFinite(maximum) || maximum <= 0) return {ok: false};
  const text = raw.trim();
  if (!text) return {ok: true, value: null};
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return {ok: false};
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > maximum) return {ok: false};
  return {ok: true, value};
}

export type ScoreStatusFilter = 'all' | 'unsubmitted' | 'ungraded' | 'graded';

export function matchesScoreFilter(
  student: {id: string; name: string},
  record: {submitted: boolean; score: unknown} | undefined,
  search: string,
  filter: ScoreStatusFilter,
): boolean {
  const term = search.trim().toLocaleLowerCase('th-TH');
  if (term && !(`${student.id} ${student.name}`.toLocaleLowerCase('th-TH').includes(term))) return false;
  if (filter === 'all') return true;
  if (record?.submitted !== true) return filter === 'unsubmitted';
  const graded = typeof record.score === 'number' && Number.isFinite(record.score);
  return graded ? filter === 'graded' : filter === 'ungraded';
}
