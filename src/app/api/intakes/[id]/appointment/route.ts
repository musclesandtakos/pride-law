import { appointmentWindow, scheduleIntakeSchema } from "@/lib/intake-workflow";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = scheduleIntakeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Choose a valid appointment date, time, and duration." }, { status: 400 });
  }

  const window = appointmentWindow(parsed.data.startsAt, parsed.data.durationMinutes);
  const { data, error } = await supabase.rpc("schedule_intake_consultation", {
    p_intake_id: id,
    p_starts_at: window.startsAt,
    p_ends_at: window.endsAt,
    p_location: parsed.data.location || null,
    p_notes: parsed.data.notes || null,
  });

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ eventId: data, startsAt: window.startsAt, endsAt: window.endsAt }, { status: 201 });
}
