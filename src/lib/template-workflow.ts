export const documentNamePlaceholders={client_name:null,notary_name:"Naomi Reinfeld",attorney_name:"Joseph Henn",witness_name:"Bobby Martinez"} as const;
export function parseTemplateSelection(value:string|undefined,limit=25){return Array.from(new Set((value||"").split(",").map(id=>id.trim()).filter(Boolean))).slice(0,limit)}
