import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import GameScores, { type GameLike } from "@/components/GameScores";
import GameGrid, { type GridRow } from "@/components/GameGrid";
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <SiteHeader />

      <div className="mt-6">
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
      </div>

      <ScoreFeedback gameId={g.id} />

      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fog">
            Plays similarly
          </h2>
          <p className="mb-4 mt-1 text-sm text-fog">
            Closest games in micro / meso / macro space.
          </p>
          <GameGrid rows={similar} />
        </section>
      )}
    </main>
  );
}
