import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"Pride Law Operations", description:"Secure legal practice management for Pride Law" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
