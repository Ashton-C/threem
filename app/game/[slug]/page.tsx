import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import GameScores, { type GameLike } from "@/components/GameScores";
import { type GridRow } from "@/components/GameGrid";
import LibraryButton from "@/components/LibraryButton";
import ScoreFeedback from "@/components/ScoreFeedback";

export const dynamic = "force-dynamic";

// nearest neighbours in 3M space (Euclidean on micro/meso/macro)
async function similarGames(game: {
  id: string;
  micro: number;
  meso: number;
  macro: number;
}): Promise<GridRow[]> {
  const { data } = await db
    .from("games")
    .select("id,slug,name,micro,meso,macro,thumbnail,release_year,featured_rank");
  return (data ?? [])
    .filter((g) => g.id !== game.id)
    .map((g) => ({
      g,
      d:
        (g.micro - game.micro) ** 2 +
        (g.meso - game.meso) ** 2 +
        (g.macro - game.macro) ** 2,
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 6)
    .map((x) => x.g as GridRow);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await db.from("games").select("name").eq("slug", slug).maybeSingle();
  return { title: data ? `${data.name} — 3M` : "3M" };
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: game } = await db
    .from("games")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!game) notFound();
  const g = game as GameLike & { id: string; slug: string; steam_url?: string | null };
  const similar = await similarGames(g);

  // known spellings that resolve to this game — helps users confirm the match
  const { data: aliasRows } = await db
    .from("game_aliases")
    .select("alias_slug")
    .eq("game_id", g.id)
    .limit(12);
  const aliases = (aliasRows ?? [])
    .map((a) => a.alias_slug.replace(/-/g, " "))
    .filter((a) => a !== g.name.toLowerCase());

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <SiteHeader />

      <div className="grid gap-10 lg:grid-cols-[1fr_260px]">
        <div>
          <GameScores
            game={g}
            actionSlot={
              <>
                {g.steam_url && (
                  <a
                    href={g.steam_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold transition hover:border-macro hover:text-paper"
                  >
                    View on Steam ↗
                  </a>
                )}
                <Link
                  href={`/compare?g=${g.slug}`}
                  className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-fog transition hover:border-macro hover:text-paper"
                >
                  Compare ↗
                </Link>
                <LibraryButton gameId={g.id} />
              </>
            }
          />

          {aliases.length > 0 && (
            <p className="mt-3 text-xs text-fog/70">
              Also matched from: {aliases.slice(0, 8).join(", ")}
            </p>
          )}

          <ScoreFeedback gameId={g.id} />
        </div>

        {/* persistent recommendations — keeps exploration going, no dead-end */}
        <aside>
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fog">
            Plays similarly
          </h2>
          <p className="mb-3 mt-1 text-xs text-fog/70">Closest in 3M space.</p>
          <div className="space-y-2">
            {similar.map((s) => (
              <Link
                key={s.id}
                href={`/game/${s.slug}`}
                className="group flex items-center gap-3 rounded-lg border border-edge bg-panel p-2 transition hover:border-macro"
              >
                {s.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={s.thumbnail} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-10 w-16 shrink-0 rounded bg-ink2" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <div className="mt-1 flex gap-1">
                    {(["micro", "meso", "macro"] as const).map((ax) => (
                      <div key={ax} className="h-1 flex-1 overflow-hidden rounded-full bg-edge">
                        <div className="h-full rounded-full" style={{ width: `${s[ax] * 10}%`, background: `var(--color-${ax})` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
