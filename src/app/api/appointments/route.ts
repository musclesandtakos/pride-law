import { canSchedule, manualAppointmentRecord, manualAppointmentSchema } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("firm_id,role,status").eq("id", user.id).maybeSingle();
  if (!profile?.firm_id || !canSchedule(profile)) {
    return Response.json({ error: "Only active firm staff can schedule appointments." }, { status: 403 });
  }
  const parsed = manualAppointmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a name, valid contact information, date, time, and duration." }, { status: 400 });
  const { data, error } = await supabase.from("events")
    .insert(manualAppointmentRecord(parsed.data, profile.firm_id)).select("id,starts_at,ends_at").single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ eventId: data.id, startsAt: data.starts_at, endsAt: data.ends_at }, { status: 201 });
}
