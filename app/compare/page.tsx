import Link from "next/link";
import { db } from "@/lib/supabase";
import CompareClient, { type CompareGame } from "@/components/CompareClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compare — 3M" };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp.g;
  const slugs = (Array.isArray(raw) ? raw : raw ? [raw] : []).slice(0, 3);

  let initial: CompareGame[] = [];
  if (slugs.length) {
    const { data } = await db
      .from("games")
      .select("id,slug,name,micro,meso,macro,thumbnail")
      .in("slug", slugs);
    // preserve the order the slugs were given in
    initial = slugs
      .map((s) => (data ?? []).find((g) => g.slug === s))
      .filter(Boolean) as CompareGame[];
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <Link href="/" className="font-display text-sm text-fog transition hover:text-paper">
        ← 3M
      </Link>
      <h1 className="font-display mt-2 text-3xl font-bold">Compare</h1>
      <p className="mt-1 text-sm text-fog">
        Stack up to three games on one triangle.
      </p>
      <div className="mt-6">
        <CompareClient initial={initial} />
      </div>
    </main>
  );
}
