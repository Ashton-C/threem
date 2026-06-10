import { db } from "@/lib/supabase";
import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "3M game breakdown";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: g } = await db
    .from("games")
    .select("name,micro,meso,macro,genre,release_year")
    .eq("slug", slug)
    .maybeSingle();

  if (!g) {
    return ogImage({ name: "Unknown game", micro: 0, meso: 0, macro: 0 });
  }

  const sub = [g.genre, g.release_year].filter(Boolean).join(" · ") || undefined;
  return ogImage({ name: g.name, sub, micro: g.micro, meso: g.meso, macro: g.macro });
}
