export const CHANNELS = { facebook: "Facebook", instagram: "Instagram", email: "Email", website: "Website", linkedin: "LinkedIn" };
export interface CalendarSlot { date: string; channel: string; objective: string; hint: string }

// Dates come from the existing planner. Prompts make no claims about an organization.
const STARTER_THEMES = [
  { objective: "Donor impact story", hint: "Bring one documented outcome, its reporting period and source. Explain what support made possible and thank supporters. Use aggregate facts unless you have consent to identify someone." },
  { objective: "Program milestone or ground update", hint: "Bring a recent milestone, its date, location and a source your team can check. Explain what changed and what happens next." },
  { objective: "Beneficiary voice", hint: "Bring the person's own approved words and an active story or quote consent record. List anyone identified under People featured. If consent is missing, use an anonymous program update instead." },
  { objective: "80G donation information", hint: "Have your team check the organization's current 80G documentation before making any tax claim. Bring the donation link and receipt contact. If eligibility is unconfirmed, write a general support reminder without promising a deduction." },
] as const;

export function starterSlots(slots: readonly CalendarSlot[]): CalendarSlot[] {
  return STARTER_THEMES.flatMap((theme, week) => {
    const slot = slots[week * 3];
    return slot ? [{ ...slot, ...theme }] : [];
  });
}

export function slotParams(slot: CalendarSlot): URLSearchParams {
  return new URLSearchParams({ date: slot.date, channel: slot.channel, topic: slot.objective, hint: slot.hint });
}

// URL data is a convenience. Draft ownership and writes remain checked by the API.
export function readSlot(params: URLSearchParams): CalendarSlot | null {
  const date = params.get("date") ?? "", channel = params.get("channel") ?? "";
  const objective = params.get("topic")?.trim() ?? "", hint = params.get("hint") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Object.hasOwn(CHANNELS, channel)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  if (objective.length < 3 || objective.length > 300 || hint.length > 2000) return null;
  return { date, channel, objective, hint };
}

export function slotDraftHref(slot: CalendarSlot): string {
  return `/content?${slotParams(slot)}#generate`;
}

export function slotCalendarHref(slot: CalendarSlot, assetId: string): string {
  const params = slotParams(slot);
  params.set("asset", assetId);
  return `/calendar?${params}#add`;
}
