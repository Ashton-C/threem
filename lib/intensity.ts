// Hardcore/Casual intensity — the demand a game places on you overall,
// derived from the mean of its three axes. Higher = more hardcore.
// Purely computed; no storage, no extra model call.

export function intensity(g: { micro: number; meso: number; macro: number }): number {
  return (g.micro + g.meso + g.macro) / 3;
}

export function intensityBand(v: number): string {
  if (v < 3.5) return "Casual";
  if (v < 5.5) return "Moderate";
  if (v < 7.5) return "Demanding";
  return "Hardcore";
}
