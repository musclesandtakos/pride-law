export const documentNamePlaceholders={client_name:null,notary_name:"Naomi Reinfeld",attorney_name:"Joseph Henn",witness_name:"Bobby Martinez"} as const;
export const intakePlaceholderFields=["client_name","client_dob","client_email","client_phone","client_address","practice_area","incident_date","incident_location","responsible_party","document_date"] as const;
export function parseTemplateSelection(value:string|undefined,limit=25){return Array.from(new Set((value||"").split(",").map(id=>id.trim()).filter(Boolean))).slice(0,limit)}
export function buildIntakePlaceholders(client:{name:string;phone:string|null;email:string|null},response?:Record<string,unknown>|null){
 const s=(v:unknown)=>typeof v==="string"?v:"";
 const address=[s(response?.address_line_1),s(response?.address_line_2),s(response?.city),s(response?.state),s(response?.postal_code)].filter(Boolean).join(", ");
 return {client_name:s(response?.legal_name)||client.name,client_dob:s(response?.date_of_birth),client_email:s(response?.email)||client.email||"",client_phone:s(response?.phone)||client.phone||"",client_address:address,practice_area:s(response?.practice_area),incident_date:s(response?.incident_date),incident_location:s(response?.incident_location),responsible_party:s(response?.opposing_parties),document_date:new Intl.DateTimeFormat("en-US").format(new Date()),notary_name:documentNamePlaceholders.notary_name,attorney_name:documentNamePlaceholders.attorney_name,witness_name:documentNamePlaceholders.witness_name};
}
