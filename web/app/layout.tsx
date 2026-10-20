import type { Metadata } from 'next';
import { Literata, Schibsted_Grotesk } from 'next/font/google';
import './globals.css';
import { Nav } from './components/nav';

// The rail shows a live count from the database, which the pipeline changes outside this app.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Job Tracker' };

const literata = Literata({ subsets: ['latin'], variable: '--font-literata', display: 'swap' });
const schibsted = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted', display: 'swap' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${literata.variable} ${schibsted.variable}`}>
      <body>
        <div className="shell">
          <Nav />
          <div className="content">{children}</div>
        </div>
      </body>
    </html>
  );
}
