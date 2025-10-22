import { DateTime } from 'luxon';

export function getCurrentWeek(dob?: string) {
  if (!dob) return 0;
  const birth = DateTime.fromISO(dob);
  return Math.max(0, Math.floor(DateTime.now().diff(birth, 'weeks').weeks));
}

export function weekToDate(dob: string, weekIndex: number) {
  const birth = DateTime.fromISO(dob);
  return birth.plus({ weeks: weekIndex });
}

export function weekLabel(dob: string | undefined, weekIndex: number) {
  if (!dob) return `Week ${weekIndex + 1}`;
  const date = weekToDate(dob, weekIndex);
  return `${date.toLocaleString(DateTime.DATE_MED)}`;
}
