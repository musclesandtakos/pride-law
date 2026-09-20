"use client";
import {ArrowLeft,Download,FileCheck2,Printer,UserRound} from "lucide-react";
import Link from "next/link";
import {useState} from "react";
import {humanizeField} from "@/lib/templates";
type PreparedTemplate={id:string;name:string;description:string|null;category:string;subsection:string;placeholder_fields:string[];downloadUrl:string|null};
type Client={id:string;name:string;phone:string|null;email:string|null};
export function TemplatePreparation({client,templates,initialPlaceholders}:{client:Client;templates:PreparedTemplate[];initialPlaceholders:Record<string,string|null>}){
 const [values,setValues]=useState<Record<string,string>>(Object.fromEntries(Object.entries(initialPlaceholders).map(([k,v])=>[k,v||""])));
 const fields=Array.from(new Set(templates.flatMap(t=>t.placeholder_fields)));
 return <section className="page template-preparation-page"><Link className="back-link" href="/templates"><ArrowLeft size={15}/> Back to form selection</Link>
 <div className="page-head"><div><span className="eyebrow">REVIEW BEFORE PRINTING</span><h1>{client.name}&apos;s forms</h1><p>Client intake has been loaded below. Reception staff can correct or complete any field before opening the selected forms.</p></div><span className="selection-count"><FileCheck2 size={17}/>{templates.length} {templates.length===1?"form":"forms"} selected</span></div>
 <div className="preparation-layout"><section className="card prepared-form-list"><div className="prepared-list-heading"><h2>Selected forms</h2><p>Review the intake values, then open each secure template to print or save.</p></div>
 {templates.map((template,index)=><article className="prepared-form-row" key={template.id}><span className="prepared-form-number">{index+1}</span><div><span className="prepared-form-path">{template.category} / {template.subsection}</span><h3>{template.name}</h3><p>{template.description||"Document template"}</p></div>{template.downloadUrl?<a className="secondary" href={template.downloadUrl} target="_blank" rel="noreferrer"><Download size={15}/> Open template</a>:<span className="download-unavailable">Unavailable</span>}</article>)}
 </section><aside className="card prepared-names"><div className="prepared-client"><UserRound size={21}/><span><small>Client from intake</small><strong>{client.name}</strong><em>{client.phone||client.email||"No contact details on file"}</em></span></div>
 <h3>Review intake placeholders</h3>{fields.map(field=><label className="prepared-name-row" key={field}><span>{humanizeField(field)}</span><input value={values[field]||""} onChange={e=>setValues(v=>({...v,[field]:e.target.value}))}/><code>{`{{${field}}}`}</code></label>)}
 <p className="placeholder-help">Document date defaults to today. Changes here are for staff review before printing; the original intake remains unchanged.</p><button className="primary" type="button" onClick={()=>window.print()}><Printer size={15}/> Print review</button></aside></div></section>
}