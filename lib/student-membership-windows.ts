export type StudentMembershipWindow = {from: number; until: number | null};

export function parseStudentMembershipWindows(value: unknown): StudentMembershipWindow[] {
  if (!Array.isArray(value) || value.length > 450) throw Error('Invalid membership windows');

  let nextStart = 0;
  return value.map(window => {
    if (!window || Object.keys(window).length !== 2) throw Error('Invalid membership window');
    const {from, until} = window;
    if (!Number.isSafeInteger(from) || from < nextStart ||
        (until !== null && (!Number.isSafeInteger(until) || until <= from))) {
      throw Error('Invalid or overlapping membership window');
    }
    nextStart = until ?? Infinity;
    return {from, until};
  });
}
