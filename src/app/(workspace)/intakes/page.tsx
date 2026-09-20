import { IntakeWorkflowModule } from "@/components/intake-workflow-module";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IntakesPage() {
  const supabase = await createClient();
  const [intakes, tasks, appointments] = await Promise.all([
    supabase
      .from("intakes")
      .select("id,name,email,phone,practice_area,source,stage,owner_name,notes,created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id,intake_id,title,due_date,status,priority")
      .not("intake_id", "is", null)
      .order("due_date", { ascending: true }),
    supabase
      .from("events")
      .select("id,intake_id,starts_at,ends_at,location")
      .not("intake_id", "is", null)
      .order("starts_at", { ascending: false }),
  ]);

  const error = intakes.error || tasks.error || appointments.error;
  if (error) throw new Error(error.message);

  return <IntakeWorkflowModule
    initialIntakes={intakes.data || []}
    initialTasks={tasks.data || []}
    initialAppointments={appointments.data || []}
  />;
}
