// The calibration anchors from the scoring rubric (lib/scoring.ts).
// Single source so the /about page and the prompt can't drift apart.

export const AXIS_INFO = {
  micro: {
    label: "Micro",
    color: "var(--color-micro)",
    blurb:
      "Moment-to-moment mechanical execution — aim, reactions, combos, precise control.",
  },
  meso: {
    label: "Meso",
    color: "var(--color-meso)",
    blurb:
      "Mid-term tactics over ~30s to a few minutes — reading opponents, tracking cooldowns, when to engage or disengage.",
  },
  macro: {
    label: "Macro",
    color: "var(--color-macro)",
    blurb:
      "Long-term strategy — economy, map control, build orders, objective pacing.",
  },
} as const;

export const ANCHORS = {
  micro: {
    high: ["CS2", "StarCraft II", "Osu!", "Street Fighter", "Apex"],
    mid: ["Dark Souls", "Monster Hunter"],
    low: ["Civilization", "Stardew"],
  },
  meso: {
    high: ["Dota 2", "Poker", "Magic", "Rainbow Six Siege"],
    mid: ["Apex", "Monster Hunter"],
    low: ["Osu!", "Stardew"],
  },
  macro: {
    high: ["Civilization", "Age of Empires", "StarCraft II", "Factorio"],
    mid: ["Hearthstone", "Magic"],
    low: ["Osu!", "Street Fighter"],
  },
} as const;

export const AXIS_KEYS = ["micro", "meso", "macro"] as const;
