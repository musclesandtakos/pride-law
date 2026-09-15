import type { Metadata } from "next";
import { PublicIntakeForm } from "@/components/public-intake-form";
import { getPublicIntakeLink } from "@/lib/client-intake";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Secure Client Intake | Pride Law" };

export default async function ClientIntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getPublicIntakeLink(token);

  return <main className="client-intake-shell">
    <header className="client-intake-header"><div className="client-intake-brand"><span className="seal small">P</span><span><strong>PRIDE LAW</strong><small>Secure Client Intake</small></span></div><span>Wilton Manors, Florida</span></header>
    <div className="client-intake-content">
      {link ? <PublicIntakeForm token={token} recipientName={link.recipient_name} recipientEmail={link.recipient_email} practiceArea={link.practice_area}/> : <div className="intake-unavailable"><span className="seal">P</span><span className="eyebrow">PRIDE LAW</span><h1>This intake link is unavailable.</h1><p>It may have expired, already been submitted, or been withdrawn. Please contact Pride Law for a new secure link.</p></div>}
    </div>
    <footer className="client-intake-footer">Confidential client intake · Pride Law · Florida</footer>
  </main>;
}

