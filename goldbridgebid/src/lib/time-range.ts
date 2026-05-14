export type TimeRange = "today" | "7d" | "30d" | "90d";

export function getRangeCutoff(range: TimeRange): string {
  const ms: Record<TimeRange, number> = {
    today: 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() - ms[range]).toISOString();
}

export function getPreviousRangeCutoff(range: TimeRange): string {
  const ms: Record<TimeRange, number> = {
    today: 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() - 2 * ms[range]).toISOString();
}

export function getRangeDays(range: TimeRange): number {
  const days: Record<TimeRange, number> = {
    today: 1,
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };
  return days[range];
}

export function isValidRange(value: string | undefined): value is TimeRange {
  return !!value && ["today", "7d", "30d", "90d"].includes(value);
}
