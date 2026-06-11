// Broader catalog to seed beyond the curated top-50, so the dataset feels
// alive. Scored like any other game (no featured_rank). The seeder dedups
// by canonical slug, so overlaps with TOP50 are harmless cache hits.

export const MORE_GAMES: string[] = [
  // shooters
  "Titanfall 2", "Destiny 2", "Halo Infinite", "Halo 3", "Rainbow Six Siege",
  "Team Fortress 2", "Borderlands 2", "Left 4 Dead 2", "Doom (2016)",
  "Wolfenstein: The New Order", "Far Cry 3", "PUBG: Battlegrounds",
  "Escape from Tarkov", "Hunt: Showdown", "Deep Rock Galactic", "Warframe",
  "Call of Duty: Modern Warfare 2 (2009)", "Battlefield 1", "Quake",
  // RPGs
  "Persona 5 Royal", "Final Fantasy VII Remake", "Final Fantasy XIV",
  "Diablo IV", "Diablo II", "Path of Exile", "Divinity: Original Sin 2",
  "Dragon Age: Inquisition", "The Elder Scrolls IV: Oblivion",
  "Fallout: New Vegas", "Fallout 4", "Nier: Automata", "Dark Souls III",
  "Demon's Souls", "Pokemon Scarlet and Violet", "Octopath Traveler",
  "Xenoblade Chronicles 3", "Chrono Trigger", "Undertale",
  "Pillars of Eternity", "Lies of P", "Elden Ring",
  // strategy
  "Age of Empires II", "Age of Empires IV", "Total War: Warhammer III",
  "Crusader Kings III", "Stellaris", "XCOM 2", "XCOM: Enemy Unknown",
  "Into the Breach", "Frostpunk", "Cities: Skylines", "RimWorld",
  "Anno 1800", "Company of Heroes", "Bloons TD 6", "Hearts of Iron IV",
  "Europa Universalis IV", "Northgard", "They Are Billions",
  // fighting
  "Tekken 8", "Mortal Kombat 1", "Guilty Gear Strive", "Super Smash Bros. Melee",
  "Dragon Ball FighterZ", "Injustice 2", "Tekken 7",
  // platformers & indies
  "Ori and the Blind Forest", "Cuphead", "Shovel Knight", "Super Meat Boy",
  "Dead Cells", "Hyper Light Drifter", "Spelunky 2", "Risk of Rain 2",
  "Vampire Survivors", "Cult of the Lamb", "Tunic", "A Hat in Time",
  "Rayman Legends", "Super Mario World", "Sonic Mania", "Katana ZERO",
  "Inside", "Limbo", "Braid", "The Binding of Isaac: Rebirth",
  "Enter the Gungeon", "Pizza Tower", "Ultrakill", "Outer Wilds",
  // sandbox / sim / survival
  "Don't Starve Together", "Subnautica", "Valheim", "ARK: Survival Evolved",
  "Rust", "The Forest", "No Man's Sky", "Astroneer", "Satisfactory",
  "Oxygen Not Included", "Two Point Hospital", "Planet Coaster", "The Sims 4",
  "Kerbal Space Program", "Palworld", "Sea of Thieves", "Dyson Sphere Program",
  // action-adventure
  "Marvel's Spider-Man", "God of War Ragnarok", "Horizon Zero Dawn",
  "Horizon Forbidden West", "Uncharted 4: A Thief's End",
  "Tomb Raider (2013)", "Assassin's Creed Valhalla", "Assassin's Creed Odyssey",
  "Death Stranding", "Control", "Alan Wake 2", "Resident Evil Village",
  "Resident Evil 2 (2019)", "Devil May Cry 5", "Bayonetta", "Nioh 2",
  "Star Wars Jedi: Fallen Order", "It Takes Two", "Metroid Dread",
  "Hi-Fi Rush", "Batman: Arkham City", "Ghostrunner",
  // racing & sports
  "Forza Horizon 5", "Gran Turismo 7", "Trackmania", "EA Sports FC 24",
  "NBA 2K24", "Need for Speed: Heat",
  // online / party
  "Smite", "Heroes of the Storm", "Fall Guys", "Among Us", "Phasmophobia",
  "Lethal Company", "Brawlhalla", "Sea of Stars",
  // card / deckbuilder / auto-battler
  "Hearthstone", "Magic: The Gathering Arena", "Legends of Runeterra",
  "Inscryption", "Marvel Snap", "Teamfight Tactics", "Yu-Gi-Oh! Master Duel",
  "Gwent", "Monster Train",
  // mobile-forward
  "Clash Royale", "Clash of Clans", "Brawl Stars", "Honkai: Star Rail",
  "Pokemon GO", "Candy Crush Saga",
];
