import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import GameScores, { type GameLike } from "@/components/GameScores";
import LibraryButton from "@/components/LibraryButton";

export const dynamic = "force-dynamic";

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
  const g = game as GameLike & { steam_url?: string | null };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <Link
        href="/"
        className="font-display text-sm text-fog transition hover:text-paper"
      >
        ← 3M
      </Link>

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
              <LibraryButton gameId={g.id} />
            </>
          }
        />
      </div>
    </main>
  );
}
