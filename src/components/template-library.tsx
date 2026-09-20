"use client";

import { Check, ChevronRight, FileText, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { documentNamePlaceholders } from "@/lib/template-workflow";

type Template = { id:string; name:string; description:string|null; category:string; subsection:string; placeholder_fields:string[]; updated_at:string };
type Client = { id:string; name:string; phone:string|null; email:string|null };

const signerPlaceholders = [
  { field:"{{client_name}}", role:"Client", value:"Pulled from the selected client intake" },
  { field:"{{notary_name}}", role:"Notary", value:documentNamePlaceholders.notary_name },
  { field:"{{attorney_name}}", role:"Attorney", value:documentNamePlaceholders.attorney_name },
  { field:"{{witness_name}}", role:"Witness", value:documentNamePlaceholders.witness_name },
];

export function TemplateLibrary({initial,clients,canManage}:{initial:Template[];clients:Client[];canManage:boolean}) {
  const [clientQuery,setClientQuery]=useState("");
  const [selectedClientId,setSelectedClientId]=useState("");
  const [templateQuery,setTemplateQuery]=useState("");
  const [selectedTemplateIds,setSelectedTemplateIds]=useState<string[]>([]);
  const deferredClientQuery=useDeferredValue(clientQuery.trim().toLowerCase());
  const deferredTemplateQuery=useDeferredValue(templateQuery.trim().toLowerCase());
  const matchingClients=useMemo(()=>clients.filter(client=>`${client.name} ${client.phone||""}`.toLowerCase().includes(deferredClientQuery)).slice(0,8),[clients,deferredClientQuery]);
  const selectedClient=clients.find(client=>client.id===selectedClientId);
  const filteredTemplates=useMemo(()=>initial.filter(template=>`${template.name} ${template.description||""} ${template.category} ${template.subsection}`.toLowerCase().includes(deferredTemplateQuery)),[initial,deferredTemplateQuery]);
  const sections=useMemo(()=>{
    const grouped=new Map<string,Map<string,Template[]>>();
    for(const template of filteredTemplates){
      const subsections=grouped.get(template.category)||new Map<string,Template[]>();
      const forms=subsections.get(template.subsection)||[];
      forms.push(template);subsections.set(template.subsection,forms);grouped.set(template.category,subsections);
    }
    return grouped;
  },[filteredTemplates]);
  function chooseClient(client:Client){setSelectedClientId(client.id);setClientQuery(client.name)}
  function toggleTemplate(id:string){setSelectedTemplateIds(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id])}
  const prepareHref=`/templates/prepare?client=${encodeURIComponent(selectedClientId)}&forms=${encodeURIComponent(selectedTemplateIds.join(","))}`;

  return <section className="page template-workflow-page">
    <div className="page-head template-workflow-head"><div><span className="eyebrow">CLIENT DOCUMENT WORKFLOW</span><h1>Prepare client forms</h1><p>Choose a client, select every form they need, then review the names used in the documents.</p></div>{canManage?<Link className="secondary" href="/templates/admin">Manage templates</Link>:null}</div>
    <div className="workflow-steps" aria-label="Document preparation steps"><span className={selectedClient?"complete":"active"}><b>1</b> Select client</span><ChevronRight size={15}/><span className={selectedTemplateIds.length?"complete":selectedClient?"active":""}><b>2</b> Choose forms</span><ChevronRight size={15}/><span className={selectedClient&&selectedTemplateIds.length?"active":""}><b>3</b> Review names</span></div>

    <section className="card workflow-section client-picker-section">
      <div className="workflow-section-heading"><span className="step-number">1</span><div><h2>Select a client</h2><p>Search the client list by name or phone number.</p></div></div>
      <div className="client-search-wrap">
        <label className="client-search-box"><Search size={18}/><span className="sr-only">Search clients by name or phone number</span><input value={clientQuery} onChange={event=>{setClientQuery(event.target.value);if(event.target.value!==selectedClient?.name)setSelectedClientId("")}} placeholder="Type a client name or phone number" autoComplete="off"/></label>
        {clientQuery&&!selectedClient?<div className="client-search-results" role="listbox" aria-label="Matching clients">{matchingClients.length?matchingClients.map(client=><button key={client.id} type="button" role="option" aria-selected="false" onClick={()=>chooseClient(client)}><UserRound size={17}/><span><strong>{client.name}</strong><small>{client.phone||"No phone number"}{client.email?` · ${client.email}`:""}</small></span></button>):<p>No client matches that name or phone number.</p>}</div>:null}
      </div>
      {selectedClient?<div className="selected-client-banner"><Check size={17}/><span><strong>{selectedClient.name}</strong><small>{selectedClient.phone||"No phone number on file"}</small></span><button type="button" onClick={()=>{setSelectedClientId("");setClientQuery("")}}>Change</button></div>:null}
    </section>

    <section className="card workflow-section form-selection-section">
      <div className="workflow-section-heading form-section-head"><span className="step-number">2</span><div><h2>Choose forms</h2><p>Select all forms the client wants completed.</p></div><label className="template-search-box"><Search size={15}/><span className="sr-only">Search forms</span><input value={templateQuery} onChange={event=>setTemplateQuery(event.target.value)} placeholder="Search forms"/></label></div>
      {Array.from(sections).map(([section,subsections])=><div className="form-section" key={section}><div className="form-section-title"><h3>{section}</h3><span>{Array.from(subsections.values()).flat().length} forms</span></div>{Array.from(subsections).map(([subsection,forms])=><fieldset className="form-subsection" key={`${section}-${subsection}`}><legend>{subsection}</legend><div className="form-check-grid">{forms.map(template=>{const checked=selectedTemplateIds.includes(template.id);return <label className={`form-check-card${checked?" selected":""}`} key={template.id}><input type="checkbox" checked={checked} onChange={()=>toggleTemplate(template.id)}/><span className="custom-check" aria-hidden="true">{checked?<Check size={14}/>:null}</span><FileText size={20}/><span><strong>{template.name}</strong><small>{template.description||"Document template"}</small></span></label>})}</div></fieldset>)}</div>)}
      {!filteredTemplates.length?<div className="form-empty"><FileText size={25}/><h3>No forms found</h3><p>{initial.length?"Try a different form search.":"An administrator can add the firm's forms in Manage templates."}</p></div>:null}
    </section>

    <section className="card workflow-section placeholder-section"><div className="workflow-section-heading"><span className="step-number">3</span><div><h2>Review document names</h2><p>These names are ready to use as placeholders in the selected forms.</p></div></div><div className="placeholder-grid">{signerPlaceholders.map(placeholder=><div className="placeholder-card" key={placeholder.field}><span>{placeholder.role}</span><strong>{placeholder.role==="Client"?selectedClient?.name||"Select a client above":placeholder.value}</strong><code>{placeholder.field}</code></div>)}</div></section>
    <div className="prepare-bar"><span><strong>{selectedTemplateIds.length}</strong> {selectedTemplateIds.length===1?"form":"forms"} selected{selectedClient?` for ${selectedClient.name}`:""}</span>{selectedClient&&selectedTemplateIds.length?<Link className="primary" href={prepareHref}>Review and download <ChevronRight size={16}/></Link>:<button className="primary" disabled>Select a client and form</button>}</div>
  </section>;
}
