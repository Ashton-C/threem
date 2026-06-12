import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { notFound } from "next/navigation";
import GameTriangle from "@/components/GameTriangle";
import { decodeStyle, archetype } from "@/lib/archetype";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const s = decodeStyle(code);
  if (!s) return { title: "3M style" };
  const arch = archetype(s.avg);
  return {
    title: `${arch.name} — my 3M style`,
    description: `A ${arch.name} across ${s.count} games. micro ${s.avg.micro.toFixed(1)} · meso ${s.avg.meso.toFixed(1)} · macro ${s.avg.macro.toFixed(1)}.`,
  };
}

const AXES = [
  { key: "micro", label: "Micro", color: "var(--color-micro)" },
  { key: "meso", label: "Meso", color: "var(--color-meso)" },
  { key: "macro", label: "Macro", color: "var(--color-macro)" },
] as const;

export default async function StylePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const s = decodeStyle(code);
  if (!s) notFound();
  const arch = archetype(s.avg);

  return (
    <main className="mx-auto max-w-xl px-6 py-10 sm:py-14">
      <SiteHeader />

      <div
        className="glow-box mt-6 rounded-2xl bg-panel p-7"
        style={{ ["--glow" as string]: arch.color }}
      >
        <p className="text-sm text-fog">A 3M gaming style across {s.count} games</p>
        <p
          className="font-display text-4xl font-bold glow-text"
          style={{ color: arch.color, ["--glow" as string]: arch.color }}
        >
          {arch.name}
        </p>

        <div className="mt-6 grid items-center gap-6 sm:grid-cols-[200px_1fr]">
          <GameTriangle game={s.avg} size={250} />
          <div className="space-y-3">
            {AXES.map((a) => (
              <div key={a.key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span style={{ color: a.color }} className="font-display font-bold">{a.label}</span>
                  <span className="font-mono tabular-nums text-fog">{s.avg[a.key].toFixed(1)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-edge">
                  <div className="h-full rounded-full" style={{ width: `${s.avg[a.key] * 10}%`, background: a.color, boxShadow: `0 0 8px ${a.color}` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/"
          className="font-display mt-7 inline-block rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink transition hover:brightness-110"
          style={{ background: "var(--color-macro)" }}
        >
          Find your style →
        </Link>
      </div>
    </main>
  );
}
