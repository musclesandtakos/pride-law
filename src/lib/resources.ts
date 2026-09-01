export const resources={
 clients:{title:"Clients",table:"clients",columns:["name","email","phone","status"],labels:{name:"Client",email:"Email",phone:"Phone",status:"Status"}},
 matters:{title:"Matters",table:"matters",columns:["matter_number","name","practice_area","stage","next_deadline"],labels:{matter_number:"Matter no.",name:"Matter",practice_area:"Practice area",stage:"Stage",next_deadline:"Next deadline"}},
 intakes:{title:"Intake Pipeline",table:"intakes",columns:["name","practice_area","source","stage","owner_name"],labels:{name:"Prospect",practice_area:"Practice area",source:"Source",stage:"Stage",owner_name:"Owner"}},
 tasks:{title:"Tasks",table:"tasks",columns:["title","assignee_name","due_date","priority","status"],labels:{title:"Task",assignee_name:"Assignee",due_date:"Due",priority:"Priority",status:"Status"}},
 events:{title:"Calendar",table:"events",columns:["starts_at","title","event_type","location"],labels:{starts_at:"Starts",title:"Event",event_type:"Type",location:"Location"}},
 documents:{title:"Documents",table:"documents",columns:["name","document_type","status","version","owner_name"],labels:{name:"Document",document_type:"Type",status:"Status",version:"Version",owner_name:"Owner"}},
 "time-entries":{title:"Time Entries",table:"time_entries",columns:["entry_date","timekeeper_name","description","hours","rate","billed"],labels:{entry_date:"Date",timekeeper_name:"Timekeeper",description:"Description",hours:"Hours",rate:"Rate",billed:"Billed"}},
 invoices:{title:"Invoices",table:"invoices",columns:["invoice_number","issue_date","due_date","status","amount","balance"],labels:{invoice_number:"Invoice",issue_date:"Issued",due_date:"Due",status:"Status",amount:"Amount",balance:"Balance"}}
} as const;
export type ResourceKey=keyof typeof resources;
