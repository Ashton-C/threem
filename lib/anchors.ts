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

// Five exemplars per band, chosen to be unambiguous and to minimise the
// same game anchoring multiple axes (cross-references are kept only where
// genuinely instructive, e.g. a pure-execution game being low on Macro).
export const ANCHORS = {
  micro: {
    high: ["Counter-Strike 2", "Osu!", "Street Fighter 6", "Tetris", "Devil May Cry 5"],
    mid: ["Dark Souls", "Hollow Knight", "Monster Hunter: World", "Hades", "Celeste"],
    low: ["Civilization VI", "Stardew Valley", "Disco Elysium", "Football Manager", "Hearthstone"],
  },
  meso: {
    high: ["Dota 2", "Rainbow Six Siege", "League of Legends", "Valorant", "Magic: The Gathering"],
    mid: ["Apex Legends", "Overwatch 2", "Sekiro: Shadows Die Twice", "Hunt: Showdown", "Teamfight Tactics"],
    low: ["Vampire Survivors", "Subway Surfers", "Cookie Clicker", "Animal Crossing: New Horizons", "Forza Horizon 5"],
  },
  macro: {
    high: ["Civilization VI", "Age of Empires IV", "Factorio", "Crusader Kings III", "StarCraft II"],
    mid: ["Slay the Spire", "Frostpunk", "Into the Breach", "Bloons TD 6", "Northgard"],
    low: ["Osu!", "Cuphead", "Geometry Dash", "Beat Saber", "Tetris"],
  },
} as const;

export const AXIS_KEYS = ["micro", "meso", "macro"] as const;
