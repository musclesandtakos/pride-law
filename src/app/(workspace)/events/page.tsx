import { WeeklyCalendar } from "@/components/weekly-calendar";
import { addDays, canSchedule, firmDateTime, validDateKey, weekStart, weekWindow } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EventsPage({ searchParams }: {
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const { week } = await searchParams;
  const today = firmDateTime(new Date()).slice(0, 10);
  const monday = weekStart(typeof week === "string" && validDateKey(week) ? week : today);
  const window = weekWindow(monday);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [events, intakes, profile] = await Promise.all([
    supabase.from("events").select("id,title,starts_at,ends_at,event_type,location,notes,intake_id")
      // Include appointments that start before this week but continue into it.
      .lt("starts_at", window.end)
      .or(`ends_at.gt.${window.start},and(ends_at.is.null,starts_at.gte.${window.start})`)
      .order("starts_at", { ascending: true }),
    supabase.from("intakes").select("id,name,email,phone,practice_area,stage")
      .not("stage", "in", '("Retained","Declined")').order("created_at", { ascending: false }),
    supabase.from("profiles").select("role,status").eq("id", user?.id || "").maybeSingle(),
  ]);
  const error = events.error || intakes.error || profile.error;
  if (error) throw new Error(error.message);
  return <WeeklyCalendar key={monday} monday={monday} today={today}
    days={Array.from({ length: 7 }, (_, index) => addDays(monday, index))}
    events={events.data || []} intakes={intakes.data || []} canEdit={canSchedule(profile.data)} />;
}
