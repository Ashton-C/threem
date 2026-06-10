import Link from "next/link";

// Persistent top nav. Server-safe (plain Links) so it works on both the
// client home page and the server pages. Pass auth UI via `right`.
const NAV = [
  { href: "/browse", label: "Explore" },
  { href: "/stats", label: "Stats" },
  { href: "/compare", label: "Compare" },
  { href: "/about", label: "About" },
];

export default function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span
            className="font-display text-2xl font-bold tracking-tight glow-text"
            style={{ ["--glow" as string]: "var(--color-macro)" }}
          >
            3M
          </span>
          <span className="flex gap-1">
            <i className="h-1.5 w-4 rounded-full" style={{ background: "var(--color-micro)" }} />
            <i className="h-1.5 w-4 rounded-full" style={{ background: "var(--color-meso)" }} />
            <i className="h-1.5 w-4 rounded-full" style={{ background: "var(--color-macro)" }} />
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-fog transition hover:text-paper">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      {right}
    </header>
  );
}
