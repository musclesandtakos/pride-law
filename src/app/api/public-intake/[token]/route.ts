import {
  getPublicIntakeLink,
  hashIntakeToken,
  publicIntakeClientForHash,
  publicIntakeSchema,
} from "@/lib/client-intake";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getPublicIntakeLink(token);
  if (!link) return Response.json({ error: "This intake link is invalid or no longer available." }, { status: 404 });

  return Response.json(
    {
      recipientName: link.recipient_name,
      recipientEmail: link.recipient_email,
      practiceArea: link.practice_area,
      expiresAt: link.expires_at,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return Response.json({ error: "This intake link is invalid or no longer available." }, { status: 404 });
  }

  const parsed = publicIntakeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Please review the required fields and try again." }, { status: 400 });
  }

  if (parsed.data.company) return Response.json({ success: true }, { status: 201 });

  const link = await getPublicIntakeLink(token);
  if (!link) return Response.json({ error: "This intake link is invalid or no longer available." }, { status: 404 });

  const tokenHash = await hashIntakeToken(token);
  const supabase = publicIntakeClientForHash(tokenHash);
  const value = parsed.data;
  const { error } = await supabase.from("client_intake_responses").insert({
    link_id: link.id,
    firm_id: link.firm_id,
    legal_name: value.legalName,
    preferred_name: value.preferredName || null,
    pronouns: value.pronouns || null,
    date_of_birth: value.dateOfBirth || null,
    email: value.email,
    phone: value.phone,
    address_line_1: value.addressLine1 || null,
    address_line_2: value.addressLine2 || null,
    city: value.city || null,
    state: value.state || null,
    postal_code: value.postalCode || null,
    preferred_contact: value.preferredContact,
    practice_area: value.practiceArea,
    incident_date: value.incidentDate || null,
    incident_location: value.incidentLocation || null,
    opposing_parties: value.opposingParties || null,
    matter_summary: value.matterSummary,
    injuries_or_damages: value.injuriesOrDamages || null,
    insurance_information: value.insuranceInformation || null,
    referral_source: value.referralSource || null,
    consent_to_contact: value.consentToContact,
    signature_name: value.signatureName,
  });

  if (error?.code === "23505") {
    return Response.json({ error: "This intake form has already been submitted." }, { status: 409 });
  }
  if (error) return Response.json({ error: "We could not save your intake. Please contact Pride Law." }, { status: 400 });

  return Response.json(
    { success: true },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}

