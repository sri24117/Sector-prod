// Suggested calendar plans for Starter (docs/plans/feature-spec-calendar-planner.md).
// A fixed, reviewed template: no AI, nothing stored, nothing invented about the organization.
// Each slot is a prompt for the organization's own facts, not finished copy.

export const CALENDAR_CHANNELS = ["facebook", "instagram", "email", "website", "linkedin"] as const;
export type CalendarChannel = (typeof CALENDAR_CHANNELS)[number];

export const DEFAULT_CHANNELS: readonly CalendarChannel[] = ["facebook", "instagram"];

// A "month" is four weeks, so a plan always has the same number of slots. 3 posting days a week
// gives 12 slots, which fits inside the 15 pieces a month Starter includes.
export const WEEKS_PER_MONTH = 4;
export const POSTING_WEEKDAYS: readonly number[] = [1, 3, 5]; // Monday, Wednesday, Friday (UTC weekday of the calendar date)

/** Exported pieces an organization needs before the three-month view opens. HUMAN DECISION: spec proposes 8. */
export const THREE_MONTH_UNLOCK_EXPORTED = 8;

// Rotated in order. `hint` tells the writer what real facts to bring; it is never published text.
export const OBJECTIVES: readonly { objective: string; hint: string }[] = [
  { objective: "Share an impact story", hint: "Bring one real example: what changed, for whom, and when. Check consent before naming anyone." },
  { objective: "Thank supporters or volunteers", hint: "Name what their help made possible, with a real figure or event." },
  { objective: "Invite people to volunteer or donate", hint: "Say exactly what you need, by when, and how to help." },
  { objective: "Announce an event or an update", hint: "Give the date, place and what people can expect." },
  { objective: "Explain your cause in plain language", hint: "One clear fact about the problem you work on and what you do about it." },
];

export interface PlanSlot { date: string; channel: CalendarChannel; objective: string; hint: string }

const DAY_MS = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Today's date in Asia/Kolkata (fixed UTC+5:30), as YYYY-MM-DD. */
export function todayIst(now: Date = new Date()): string { return isoDate(new Date(now.getTime() + 330 * 60_000)); }

/**
 * Slots on Mon/Wed/Fri for `months` x four weeks from `start` (inclusive, YYYY-MM-DD).
 * Channels and objectives rotate independently so a channel sees every objective over time.
 */
export function suggestPlan(opts: { start: string; months: 1 | 3; channels?: readonly CalendarChannel[] }): PlanSlot[] {
  const channels = opts.channels?.length ? [...new Set(opts.channels)] : [...DEFAULT_CHANNELS];
  const first = new Date(`${opts.start}T00:00:00Z`);
  const days = opts.months * WEEKS_PER_MONTH * 7;
  const slots: PlanSlot[] = [];
  for (let offset = 0; offset < days; offset++) {
    const day = new Date(first.getTime() + offset * DAY_MS);
    if (!POSTING_WEEKDAYS.includes(day.getUTCDay())) continue;
    const i = slots.length;
    const { objective, hint } = OBJECTIVES[i % OBJECTIVES.length]!;
    slots.push({ date: isoDate(day), channel: channels[i % channels.length]!, objective, hint });
  }
  return slots;
}
