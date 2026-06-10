import { ogImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-card";
import { decodeStyle, archetype } from "@/lib/archetype";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "My 3M gaming style";

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const s = decodeStyle(code);
  if (!s) return ogImage({ name: "3M style", micro: 0, meso: 0, macro: 0 });

  const arch = archetype(s.avg);
  return ogImage({
    name: arch.name,
    sub: `My 3M gaming style · ${s.count} games`,
    micro: Math.round(s.avg.micro),
    meso: Math.round(s.avg.meso),
    macro: Math.round(s.avg.macro),
    footer: "micro · meso · macro — find your style at 3M",
  });
}
