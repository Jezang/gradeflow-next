import {validStudentProjectionId} from './student-projection-document.ts';

export function projectedCourseId(workId:string) {
  const match = /^([1-9][0-9]{0,2})_/.exec(workId);
  if (!match) return null;
  const start = match[0].length;
  const end = start+Number(match[1]);
  const courseId = workId.slice(start,end);
  return workId[end] === '_' && validStudentProjectionId(courseId) &&
    validStudentProjectionId(workId.slice(end+1)) ? courseId : null;
}

export function privateRankBand(own:number, peerScores:readonly number[]) {
  // Require nine comparable peers. Share only a broad band and keep ties together.
  if (peerScores.length < 9) return null;
  const ahead = peerScores.filter(score => score > own).length;
  const tied = peerScores.filter(score => score === own).length;
  if (tied === peerScores.length) return null;
  const size = peerScores.length+1;
  const midpoint = (ahead+tied/2)/size;
  return midpoint < 0.25 ? 'top-quarter' : midpoint < 0.5 ? 'top-half' : 'lower-half';
}
