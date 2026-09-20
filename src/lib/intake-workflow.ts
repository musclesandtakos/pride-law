import { z } from "zod";

export const scheduleIntakeSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  location: z.string().trim().max(300).optional().default(""),
  notes: z.string().trim().max(2_000).optional().default(""),
});

export function appointmentWindow(startsAt: string, durationMinutes: number) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

