import type { Metadata } from "next";
import "./globals.css";
import "./users.css";
export const metadata: Metadata = { title:"WritRelay", description:"Secure legal practice management for law firms" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
