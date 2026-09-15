"use client";

import { useState } from "react";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { practiceAreas } from "@/lib/intake-fields";

type Props = {
  token: string;
  recipientName: string;
  recipientEmail: string;
  practiceArea: string | null;
};

export function PublicIntakeForm({ token, recipientName, recipientEmail, practiceArea }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setSubmitting(true);
    setError("");
    const payload: Record<string, FormDataEntryValue | boolean> = Object.fromEntries(formData);
    payload.consentToContact = formData.get("consentToContact") === "on";

    const response = await fetch(`/api/public-intake/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(body.error || "We could not save your intake. Please contact Pride Law.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) return <div className="intake-complete" role="status">
    <CheckCircle2 size={42}/><span className="eyebrow">SUBMISSION RECEIVED</span><h1>Thank you, {recipientName.split(" ")[0]}.</h1>
    <p>Your information was securely delivered to Pride Law. A member of the firm will contact you after reviewing it.</p>
    <small>Submitting this form does not create an attorney-client relationship.</small>
  </div>;

  return <form action={submit} className="public-intake-form">
    <div className="intake-form-heading"><LockKeyhole size={20}/><div><span className="eyebrow">SECURE CLIENT INTAKE</span><h1>Tell us how we can help</h1><p>Please complete the form below. Fields marked * are required.</p></div></div>
    {error && <div className="error" role="alert">{error}</div>}
    <input className="intake-honeypot" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true"/>

    <fieldset><legend>Your information</legend><div className="intake-form-grid">
      <label>Legal name *<input name="legalName" defaultValue={recipientName} autoComplete="name" required/></label>
      <label>Preferred name<input name="preferredName" autoComplete="nickname"/></label>
      <label>Pronouns<input name="pronouns" placeholder="Optional"/></label>
      <label>Date of birth<input name="dateOfBirth" type="date" autoComplete="bday"/></label>
      <label>Email *<input name="email" type="email" defaultValue={recipientEmail} autoComplete="email" required/></label>
      <label>Phone *<input name="phone" type="tel" autoComplete="tel" required/></label>
      <label className="wide">Street address<input name="addressLine1" autoComplete="address-line1"/></label>
      <label className="wide">Apartment, suite, or unit<input name="addressLine2" autoComplete="address-line2"/></label>
      <label>City<input name="city" autoComplete="address-level2"/></label>
      <label>State<input name="state" autoComplete="address-level1"/></label>
      <label>ZIP code<input name="postalCode" autoComplete="postal-code"/></label>
      <label>Preferred contact *<select name="preferredContact" defaultValue="Email"><option>Email</option><option>Phone</option><option>Text</option></select></label>
    </div></fieldset>

    <fieldset><legend>About your legal matter</legend><div className="intake-form-grid">
      <label>Practice area *<select name="practiceArea" defaultValue={practiceArea || "Personal Injury"}>{practiceAreas.map((area) => <option key={area}>{area}</option>)}</select></label>
      <label>Date of incident or event<input name="incidentDate" type="date"/></label>
      <label className="wide">Where did it happen?<input name="incidentLocation"/></label>
      <label className="wide">Names of other people or organizations involved<textarea name="opposingParties" rows={3} placeholder="This helps us check for conflicts of interest."/></label>
      <label className="wide">Please describe what happened and the help you need. *<textarea name="matterSummary" rows={7} minLength={20} required/></label>
      <label className="wide">Injuries, losses, or other damages<textarea name="injuriesOrDamages" rows={4}/></label>
      <label className="wide">Insurance information<textarea name="insuranceInformation" rows={3} placeholder="Carrier, policy or claim number, if available."/></label>
      <label className="wide">How did you hear about Pride Law?<input name="referralSource"/></label>
    </div></fieldset>

    <fieldset><legend>Consent and signature</legend>
      <label className="intake-checkbox"><input name="consentToContact" type="checkbox" required/><span>I authorize Pride Law to contact me about this inquiry. I understand that submitting this form does not create an attorney-client relationship and that representation begins only after a written agreement is signed. *</span></label>
      <label>Electronic signature *<input name="signatureName" placeholder="Type your full legal name" required/><small>Typing your name confirms that the information above is accurate to the best of your knowledge.</small></label>
    </fieldset>

    <button className="primary intake-submit" disabled={submitting}>{submitting ? "Submitting securely…" : "Submit secure intake"}</button>
    <p className="intake-privacy-note"><LockKeyhole size={13}/> Your information is encrypted in transit and accessible only to authorized Pride Law staff.</p>
  </form>;
}
