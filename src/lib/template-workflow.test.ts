import {describe,expect,it} from "vitest";
import {documentNamePlaceholders,parseTemplateSelection} from "./template-workflow";
describe("template workflow",()=>{it("deduplicates and limits selected forms",()=>{expect(parseTemplateSelection("one,two,one,three",2)).toEqual(["one","two"])});it("provides the requested document names",()=>{expect(documentNamePlaceholders).toEqual({client_name:null,notary_name:"Naomi Reinfeld",attorney_name:"Joseph Henn",witness_name:"Bobby Martinez"})})});
