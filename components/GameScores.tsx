import Link from "next/link";
import ScoreBar from "./ScoreBar";
import GameTriangle from "./GameTriangle";

export type GameLike = {
  id: string;
  name: string;
  micro: number;
  meso: number;
  macro: number;
  reasoning: { micro: string; meso: string; macro: string };
  confidence?: string | null;
  steam_url?: string | null;
  thumbnail?: string | null;
  genre?: string | null;
  subgenres?: string[] | null;
  publisher?: string | null;
  release_year?: number | null;
};

const AXES = [
  { key: "micro", label: "Micro", color: "var(--color-micro)", desc: "moment-to-moment execution" },
  { key: "meso", label: "Meso", color: "var(--color-meso)", desc: "mid-term tactics" },
  { key: "macro", label: "Macro", color: "var(--color-macro)", desc: "long-term strategy" },
] as const;

// Pure presentation. Library/steam actions are passed in via `actionSlot`
// so this stays usable from both the client home page and server game pages.
export default function GameScores({
  game,
  cached,
  actionSlot,
}: {
  game: GameLike;
  cached?: boolean;
  actionSlot?: React.ReactNode;
}) {
  return (
    <article
      className="glow-box overflow-hidden rounded-2xl bg-panel"
      style={{ ["--glow" as string]: "var(--color-macro)" }}
    >
      {game.thumbnail && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={game.thumbnail} alt={game.name} className="max-h-52 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-panel to-transparent" />
        </div>
      )}

      <div className="p-6 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="font-display text-3xl font-bold">{game.name}</h2>
          {cached && (
            <span className="rounded-full border border-edge px-2 py-0.5 text-[11px] uppercase tracking-wider text-fog">
              cached · instant
            </span>
          )}
        </div>

        {(game.release_year || game.publisher) && (
          <p className="mt-1 text-sm text-fog">
            {game.release_year && <span>{game.release_year}</span>}
            {game.release_year && game.publisher && <span> · </span>}
            {game.publisher && (
              <Link
                href={`/browse?publisher=${encodeURIComponent(game.publisher)}`}
                className="underline-offset-2 transition hover:text-paper hover:underline"
              >
                {game.publisher}
              </Link>
            )}
          </p>
        )}

        {(game.genre || game.subgenres?.length) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {game.genre && (
              <Link
                href={`/browse?genre=${encodeURIComponent(game.genre)}`}
                className="rounded-full bg-edge px-2.5 py-0.5 text-xs font-semibold transition hover:brightness-125"
              >
                {game.genre}
              </Link>
            )}
            {game.subgenres?.map((sg) => (
              <Link
                key={sg}
                href={`/browse?genre=${encodeURIComponent(sg)}`}
                className="rounded-full border border-edge px-2.5 py-0.5 text-xs text-fog transition hover:border-fog hover:text-paper"
              >
                {sg}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-7 grid gap-7 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="space-y-6">
            {AXES.map((a, i) => (
              <ScoreBar
                key={a.key}
                label={a.label}
                desc={a.desc}
                score={game[a.key]}
                color={a.color}
                delay={i * 0.12}
                reason={game.reasoning?.[a.key]}
              />
            ))}
          </div>
          <div className="mx-auto w-full max-w-[220px] sm:w-[200px]">
            <GameTriangle game={game} size={200} />
            <p className="mt-1 text-center text-[11px] text-fog/70">balance across the three axes</p>
          </div>
        </div>

        {actionSlot && <div className="mt-7 flex flex-wrap gap-2">{actionSlot}</div>}
      </div>
    </article>
  );
}
