type MasterStudent = { id: string; name: string; active: boolean };
type RosterStudent = { id: string; active: boolean };

export type RosterPreviewRow = {
 id: string;
 name?: string;
 status: 'new' | 'reactivate' | 'enrolled' | 'unavailable' | 'invalid';
};

export function previewBulkRoster(
 raw: string,
 master: MasterStudent[],
 roster: RosterStudent[],
): RosterPreviewRow[] | null {
 const ids = [...new Set(raw.split(/[\s,]+/).filter(Boolean))];
 if (ids.length > 500) return null;
 const masterById = new Map(master.map(student => [student.id, student]));
 const rosterById = new Map(roster.map(student => [student.id, student]));
 const ambiguous = new Set<string>();
 for (const records of [master, roster]) {
  const seen = new Set<string>();
  for (const {id} of records) {
   if (seen.has(id)) ambiguous.add(id);
   seen.add(id);
  }
 }
 return ids.map(id => {
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(id)) return { id, status: 'invalid' };
  if (ambiguous.has(id)) return { id, status: 'unavailable' };
  const student = masterById.get(id);
  if (!student?.active) return { id, status: 'unavailable' };
  const enrolled = rosterById.get(id);
  return { id, name: student.name, status: enrolled ? (enrolled.active ? 'enrolled' : 'reactivate') : 'new' };
 });
}
