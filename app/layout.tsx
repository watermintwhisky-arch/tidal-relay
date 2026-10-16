import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Tidal Relay — race the tide',description:'A quick strategy game for humans and agents. Salvage pearls, read the tide, and bank your haul.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
