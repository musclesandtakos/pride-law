import Link from "next/link";
import { recordIdSchema } from "@/lib/search";
import { IntakeWorkflowModule } from "@/components/intake-workflow-module";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IntakesPage({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  const record = recordIdSchema.safeParse((await searchParams).record);
  const supabase = await createClient();
  let intakeQuery = supabase.from("intakes")
    .select("id,name,email,phone,practice_area,source,stage,owner_name,notes,created_at")
    .order("created_at", { ascending: false });
  if (record.success) intakeQuery = intakeQuery.eq("id", record.data);
  const [intakes, tasks, appointments] = await Promise.all([
    intakeQuery,
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

  return <>{record.success && <div className="search-record-context">Search result · <Link href="/intakes">View all intakes</Link></div>}
  <IntakeWorkflowModule key={record.success ? record.data : "intakes"} initialView={record.success ? "all" : "attention"}
    initialIntakes={intakes.data || []}
    initialTasks={tasks.data || []}
    initialAppointments={appointments.data || []}
  /></>;
}
