import {describe,expect,it} from "vitest";
import {resources} from "./resources";
describe("legal resources",()=>{it("contains all core practice modules",()=>{expect(Object.keys(resources)).toEqual(expect.arrayContaining(["clients","matters","intakes","tasks","events","documents","time-entries","invoices"]))});it("maps unique tables",()=>{const tables=Object.values(resources).map(x=>x.table);expect(new Set(tables).size).toBe(tables.length)})});
