'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/new', label: 'New this week' },
  { href: '/', label: 'Jobs' },
];

export function NavLinks({ newCount }: { newCount: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      <p className="rail-label">Job search</p>
      <ul>
        {LINKS.map((l) => {
          const active = l.href === '/' ? path === '/' || path.startsWith('/jobs') : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link href={l.href} className={active ? 'rail-link active' : 'rail-link'} aria-current={active ? 'page' : undefined}>
                <span>{l.label}</span>
                {l.href === '/new' && newCount > 0 && <span className="count">{newCount}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
