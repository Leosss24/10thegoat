export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function madridDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}

// Calendar dates avoid assuming Madrid always has the same UTC offset.
export function releaseDate(launchDate: string | null, week: number): string | null {
  if (!launchDate || !validDate(launchDate) || !Number.isInteger(week) || week < 0) return null;
  if (week === 0) return launchDate;
  const date = new Date(`${launchDate}T00:00:00Z`);
  const untilMonday = (8 - date.getUTCDay()) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + untilMonday + (week - 1) * 7);
  return date.toISOString().slice(0, 10);
}

export function isReleased(week: number, launchDate: string | null, now: Date): boolean {
  if (week === 0) return true;
  const release = releaseDate(launchDate, week);
  return release !== null && madridDate(now) >= release;
}
