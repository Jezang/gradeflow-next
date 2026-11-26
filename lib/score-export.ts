export const scoreExportColumns = [
  {key: 'studentId', label: 'รหัส'},
  {key: 'name', label: 'ชื่อ'},
  {key: 'expected', label: 'จำนวนงาน'},
  {key: 'submitted', label: 'ส่งแล้ว'},
  {key: 'graded', label: 'ตรวจแล้ว'},
  {key: 'points', label: 'คะแนนรวม'},
  {key: 'maximum', label: 'คะแนนเต็ม'},
  {key: 'grade', label: 'เกรดจำลอง'},
] as const;

type ColumnKey = (typeof scoreExportColumns)[number]['key'];
export type ScoreExportRow = {
  studentId: string;
  name: string;
  expected: number;
  submitted: number;
  graded: number;
  points: number;
  maximum: number;
  grade: string | null;
};
export type ExportScope = {term: string; subject: string; room: string};
export type SheetsMapping = Partial<Record<ColumnKey, string>>;

export function scoreExportTable(scope: ExportScope, students: readonly ScoreExportRow[]) {
  const ids = new Set<string>();
  const rows = students.map(student => {
    if (!student.studentId.trim() || student.studentId !== student.studentId.trim() ||
        /[\u0000-\u001f\u007f]/.test(student.studentId) || ids.has(student.studentId)) {
      throw Error('invalid student IDs');
    }
    if (![student.expected, student.submitted, student.graded, student.points, student.maximum].every(Number.isFinite)) {
      throw Error('invalid numeric export values');
    }
    ids.add(student.studentId);
    return scoreExportColumns.map(({key}) => student[key]);
  });
  return [
    ['ภาคเรียน', scope.term],
    ['รายวิชา', scope.subject],
    ['ห้อง', scope.room],
    ['ขอบเขต', 'งานและรายชื่อนักเรียนที่เปิดใช้งาน ณ เวลาที่อ่านข้อมูล'],
    scoreExportColumns.map(({label}) => label),
    ...rows,
  ];
}

export function previewSheetsMapping(rawSheet: string, rawMapping: SheetsMapping) {
  const sheet = rawSheet.trim();
  if (!sheet || /[\u0000-\u001f]/.test(sheet)) {
    return {ok: false, reason: 'sheet'} as const;
  }

  const mapping: {key: ColumnKey; column: string}[] = [];
  const usedColumns = new Set<string>();
  for (const {key} of scoreExportColumns) {
    const column = rawMapping[key]?.trim().toUpperCase() ?? '';
    if (!column) continue;
    if (!/^[A-Z]{1,3}$/.test(column)) return {ok: false, reason: 'column'} as const;
    if (usedColumns.has(column)) return {ok: false, reason: 'duplicate'} as const;
    mapping.push({key, column});
    usedColumns.add(column);
  }
  if (!mapping.some(({key}) => key === 'studentId')) return {ok: false, reason: 'id'} as const;
  if (mapping.length < 2) return {ok: false, reason: 'fields'} as const;

  return {ok: true, sheet, mapping} as const;
}
