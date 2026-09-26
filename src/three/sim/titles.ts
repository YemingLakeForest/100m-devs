/*
 * Copied from the rebuild (100m-devs-three/src/sim/titles.ts) on 2026-09-26, when the user
 * asked for the rebuild's cover art and title generation to be ported: the
 * rebuild is read-only reference now, so this copy is the one that changes. See
 * docs/PLAN-2026-09-26-return.md.
 */
/**
 * What the studio's games are called — GDD §10.6.1 [added 2026-09-14, at the
 * user's instruction].
 *
 * The ladder used to carry three names — *Flappy Square 1.0*, *1.1 (Now With
 * Ads)*, *2.0 (Now With A Battle Pass)* — and then *Flappy Square N.0* for
 * ever. The joke was §1's thesis in three lines and it was a good joke exactly
 * three times; a wall of forty of them read as a placeholder nobody had come
 * back for, and the user said so: *"flappy square version N won't fly."*
 *
 * **Generated, never stored**, on the same contract §7.8.7 uses for faces: a
 * title is a pure function of `(seed, ordinal)`, so the game on the HUD's
 * Project cell is the game the gallery will show, and a reload cannot rename
 * a release the player has already read reviews of.
 *
 * ## The grammar
 *
 * A title names a **genre**, and the genre is the one thing the cover needs
 * from it — §10.5's amendment says every cover on the wall rolled the same
 * subject because every title said "flappy". Each genre has its own nouns,
 * head words and subtitles, so *Velvet Dungeon* is a roguelike before anyone
 * has drawn the die on its box; the shared adjectives, places, gerunds and
 * possessives are what stop ten genres reading as ten lists.
 *
 * Eleven forms, chosen by roll. Ordinal 0 is held to the two short forms
 * because the first game a garage ships should *sound* small.
 *
 * ## Four rules the first draft got wrong, and this file tests
 *
 *  1. **Plurals are a table, not an `s`.** The gerund form asked for
 *     `${noun}s` and produced *Chasing Hexs* and *Counting Colonys*. The
 *     plural is looked up in {@link PLURALS} and the form is skipped for a
 *     noun that has no entry, which is also how *Chasing Thunders* stopped
 *     happening — some nouns are simply not countable and no rule can tell.
 *  2. **Compounds are curated.** `{Noun} {Noun}` over the whole genre list
 *     produced *Orchard Pumpkin* and *Knot Mosaic*, which are two nouns rather
 *     than a title. The second word comes from a short list of **head words**
 *     per genre — the ones a box can end on — so the form makes *Comet
 *     Blaster* and *Harvest Valley* and cannot make the other thing.
 *  3. **No repeats inside the shelf's memory.** A name equal to any of the
 *     previous twelve rerolls its form on a second channel. A sequel is
 *     exempt, because a sequel sharing a base with the game before it is the
 *     point of a sequel.
 *  4. **The first sequel is II.** The draft numbered it *III* — it indexed a
 *     numeral table by the chain depth *plus one* against a table that already
 *     started at *II* — so the second game in every chain skipped a number.
 *
 * ## Sequels and the suffix — §1's joke, kept, and rationed
 *
 * The old ladder's whole point was the same game shipped three times with a
 * worse monetisation model bolted on. That survives as two rare events rather
 * than the rule: about one title in six is a **sequel** of the one before it
 * (same base, same genre, a numeral or a subtitle), and about one in ten past
 * the first carries a **suffix** — *(Now With Ads)*, *(Early Access)*,
 * *(Season Pass Edition)*. Rationed because a joke that fires on every row
 * stops being one; rare enough that a wall of covers still has the occasional
 * *Hollow Orbit II: Afterburner (Free To Start)* on it, which is funnier for
 * being surrounded by games that are not.
 *
 * Pure — no store, no clock, no renderer.
 */

import { draw } from './identity.ts'

/**
 * The ten genres a title can name. Each is one cover subject in
 * `art/coverPixels.ts`, which is why the list is closed rather than free text.
 */
export const GENRES = [
  'arcade',
  'roguelike',
  'rpg',
  'tycoon',
  'survival',
  'racer',
  'puzzle',
  'platformer',
  'horror',
  'farming',
] as const

export type Genre = (typeof GENRES)[number]

/** What a genre is called on a box — for the *Untitled … Game* form. */
const GENRE_LABEL: Record<Genre, string> = {
  arcade: 'Arcade',
  roguelike: 'Roguelike',
  rpg: 'RPG',
  tycoon: 'Tycoon',
  survival: 'Survival',
  racer: 'Racing',
  puzzle: 'Puzzle',
  platformer: 'Platformer',
  horror: 'Horror',
  farming: 'Farming',
}

export interface Title {
  name: string
  genre: Genre
  /** The name without any sequel numeral or suffix — what a sequel is *of*. */
  base: string
  /** 0 for an original; the depth of the chain otherwise (1 = *II*). */
  sequel: number
}

/** Longest title the HUD's rail can carry without ellipsis at every size. */
export const MAX_TITLE_LENGTH = 34

/**
 * How many titles back the catalogue remembers before a name may come round
 * again — rule 3 in the file header.
 *
 * Twelve because that is about a screen of §10.11's wall and comfortably more
 * than the three covers the shelf tray shows: two identical names on screen at
 * once is the failure, and twelve is the largest window in which that can
 * happen.
 */
export const TITLE_WINDOW = 12

/**
 * Past this ordinal a title is rolled on its own, with no window and no chain.
 *
 * The window and the sequel chain are both defined against *the title before*,
 * so a name is genuinely a function of every name ahead of it and the only
 * honest way to compute one is to compute the catalogue. That is cheap at the
 * hundreds of releases a run reaches and is not a thing to do a hundred
 * thousand times for a studio that has been left running overnight. Past the
 * limit the grammar still answers — the same name for the same ordinal, for
 * ever — it just stops being able to make a sequel of a game nobody can still
 * see on the wall.
 */
const CHAIN_LIMIT = 5_000

/** Channel numbers, kept together so two draws can never share one. */
const CH = {
  genre: 101, form: 102, adj: 103, noun: 104, head: 105, place: 106, sub: 107,
  verb: 108, sequel: 109, sequelForm: 110, suffix: 111, suffixPick: 112,
  possessive: 113, superlative: 114, amp: 115, untitled: 116, plural: 117,
} as const

/**
 * The stride between one composition pass and the next — rule 3's "second
 * channel". Wider than the block above so a reroll cannot land on a draw the
 * first pass already spent.
 */
const CHANNEL_PASS = 40

/** Pick from a list. Separated so every table reads the same way. */
function pick<T>(list: readonly T[], r: number): T {
  return list[Math.min(list.length - 1, Math.floor(r * list.length))]
}

/**
 * Shared across genres: ordinary words, because a studio's back catalogue is
 * not a list of genre tags. None of them is a joke on its own.
 */
const ADJECTIVES = [
  'Hollow', 'Velvet', 'Iron', 'Neon', 'Paper', 'Silent', 'Crimson', 'Little',
  'Endless', 'Rusty', 'Wandering', 'Midnight', 'Sunken', 'Golden', 'Broken',
  'Tiny', 'Solar', 'Frozen', 'Electric', 'Forgotten', 'Loud', 'Humble',
  'Radiant', 'Copper', 'Feral', 'Distant', 'Salty', 'Glass', 'Marble', 'Peculiar',
  'Quiet', 'Bitter', 'Gentle', 'Woolly', 'Restless', 'Gilded', 'Hungry',
  'Patient', 'Reckless', 'Wayward', 'Stubborn', 'Amber', 'Bright', 'Splendid',
  'Terrible', 'Modest', 'Grim', 'Lonesome', 'Cheerful', 'Vast', 'Obsolete',
  'Stalwart', 'Thorough', 'Absurd', 'Elegant', 'Nimble', 'Weary', 'Curious',
  'Brittle', 'Sombre',
] as const

/** For the `{Noun} of {Place}` form. A place is anything a noun can be "of". */
const PLACES = [
  'Spreadsheets', 'the Deep', 'Ash', 'Tomorrow', 'the North', 'Glass', 'Salt',
  'Last Light', 'the Long Dark', 'Second Breakfast', 'the Small Hours',
  'the Lowlands', 'Static', 'the Ninth Floor', 'Yesterday', 'Thunder', 'Moss',
  'Tin', 'the Quiet Sea', 'Overtime', 'the Hollow Coast', 'Rust', 'Embers',
  'the Third Winter', 'Paperwork', 'the Far Meadow', 'Nightfall', 'Cinders',
  'the Open Road', 'Brass', 'the Undertow', 'Lanterns', 'the Slow River',
  'Hollowmere', 'the Thin Ice', 'Chalk',
] as const

/** For the `{Gerund} {Noun-plural}` form. See {@link PLURALS}. */
const GERUNDS = [
  'Herding', 'Chasing', 'Escaping', 'Building', 'Losing', 'Feeding', 'Counting',
  'Painting', 'Haunting', 'Racing', 'Sailing', 'Digging', 'Folding', 'Stacking',
  'Forgetting', 'Waking', 'Mending', 'Sorting', 'Dodging', 'Collecting',
  'Trading', 'Minding', 'Outrunning', 'Befriending', 'Stealing', 'Naming',
  'Watering', 'Burying',
] as const

/**
 * For the `{Possessive} {Noun}` form.
 *
 * All of them name a *person*, which is what makes the form work: *Nobody's
 * Orchard* and *The Auditor's Dungeon* are both a small story, and a
 * possessive that named a place would just be the "of" form backwards.
 */
const POSSESSIVES = [
  "Nobody's", "The Intern's", "Grandma's", "The Baron's", "The Witch's",
  "My Father's", "The Janitor's", "Everyone's", "The Dragon's",
  "The Landlord's", "Somebody's", "The Auditor's", "The Ferryman's",
  "The Beekeeper's", "The Night Shift's", "The Committee's",
] as const

/** The `Super {Noun}` family. Arcade, racer and platformer only — see FORMS. */
const SUPERLATIVES = ['Super', 'Mega', 'Ultra', 'Hyper'] as const

/**
 * The monetisation suffixes — §1's thesis, one bracket at a time. Never on the
 * first game and never common; see the file header.
 */
export const SUFFIXES = [
  '(Now With Ads)',
  '(Early Access)',
  '(Deluxe Edition)',
  '(Season Pass Edition)',
  '(Definitive Edition)',
  '(Free To Start)',
  '(Now With A Battle Pass)',
  '(Remastered)',
  "(Director's Cut)",
  '(Game of the Fiscal Year Edition)',
  '(Now With Loot Boxes)',
  '(Cloud Version)',
] as const

interface GenreWords {
  nouns: readonly string[]
  /** Rule 2 — the words a compound may *end* on. Never the first word. */
  heads: readonly string[]
  subtitles: readonly string[]
}

/**
 * The genre vocabularies. A noun here is what the game is *about*; a head is
 * what a box can end on; a subtitle is the thing after the colon.
 *
 * Twenty-four nouns each, which is the size at which two runs of the same
 * genre stop sharing one: at twelve, a two-hundred-game career put *Dungeon*
 * on the wall nine times.
 */
const WORDS: Record<Genre, GenreWords> = {
  arcade: {
    nouns: [
      'Comet', 'Orbit', 'Blaster', 'Meteor', 'Rocket', 'Pixel', 'Asteroid', 'Laser',
      'Satellite', 'Shuttle', 'Zapper', 'Nova', 'Vector', 'Quasar', 'Photon', 'Bumper',
      'Cannon', 'Drone', 'Grid', 'Pulsar', 'Turret', 'Warp', 'Zenith', 'Ion',
    ],
    heads: ['Blaster', 'Zapper', 'Cannon', 'Rush', 'Frenzy', 'Patrol', 'Squadron', 'Turret'],
    subtitles: [
      'Reload', 'Hyperspace', 'Zero Gravity', 'Overdrive', 'Afterburner', 'High Score',
      'Extra Life', 'Insert Coin', 'Attract Mode', 'Wave Ten', 'Free Play', 'Bonus Stage',
    ],
  },
  roguelike: {
    nouns: [
      'Dungeon', 'Crypt', 'Deck', 'Labyrinth', 'Descent', 'Catacomb', 'Gambit', 'Relic',
      'Vault', 'Rune', 'Hex', 'Oubliette', 'Sigil', 'Warren', 'Cellar', 'Tomb',
      'Spire', 'Cairn', 'Wager', 'Threshold', 'Undercroft', 'Talisman', 'Gauntlet', 'Keep',
    ],
    heads: ['Crawl', 'Descent', 'Gambit', 'Run', 'Delve', 'Keep', 'Vault'],
    subtitles: [
      'Descent', 'The Ninth Floor', 'Permadeath', 'One More Run', 'Reroll',
      'Cursed Edition', 'No Save Points', 'Seeded', 'The Long Corridor',
      'Item Locked', 'Floor Twenty', 'Ashes Again',
    ],
  },
  rpg: {
    nouns: [
      'Blade', 'Kingdom', 'Dragon', 'Quest', 'Knight', 'Sword', 'Prophecy', 'Throne',
      'Oath', 'Realm', 'Wyrm', 'Saga', 'Banner', 'Chronicle', 'Herald', 'Covenant',
      'Warden', 'Crown', 'Sentinel', 'Lament', 'Vow', 'Pilgrim', 'Bastion', 'Grimoire',
    ],
    heads: ['Quest', 'Saga', 'Chronicle', 'Crusade', 'Legacy', 'Covenant'],
    subtitles: [
      'The Oath', 'Second Age', 'Ashes of Kings', 'The Long Road', 'Blood and Ledger',
      'Chosen Again', 'The Sundered Crown', 'Heirs of Dust', 'A Colder Throne',
      'The Ninth Banner', 'Vows Unkept', 'The Last Pilgrimage',
    ],
  },
  tycoon: {
    nouns: [
      'Tycoon', 'Empire', 'Ledger', 'Spreadsheet', 'Merchant', 'Factory', 'Franchise',
      'Mogul', 'Warehouse', 'Enterprise', 'Monopoly', 'Quarterly', 'Conglomerate',
      'Boardroom', 'Portfolio', 'Syndicate', 'Depot', 'Margin', 'Dividend', 'Logistics',
      'Baron', 'Cartel', 'Assembly', 'Holding',
    ],
    heads: ['Tycoon', 'Empire', 'Baron', 'Magnate', 'Simulator', 'Manager'],
    subtitles: [
      'Quarterly Results', 'Synergy', 'Hostile Takeover', 'The Merger', 'Going Public',
      'Fiscal Year', 'Cost Centre', 'Shareholder Value', 'The Audit', 'Market Share',
      'Restructuring', 'Growth At All Costs',
    ],
  },
  survival: {
    nouns: [
      'Island', 'Wilds', 'Bunker', 'Frontier', 'Outpost', 'Colony', 'Wasteland',
      'Homestead', 'Shelter', 'Expedition', 'Tundra', 'Raft', 'Ration', 'Signal',
      'Permafrost', 'Salvage', 'Quarantine', 'Beacon', 'Driftwood', 'Foothold',
      'Provision', 'Stockpile', 'Treeline', 'Thaw',
    ],
    heads: ['Outpost', 'Shelter', 'Expedition', 'Protocol', 'Winter', 'Bunker'],
    subtitles: [
      'Day One', 'Winter', 'Low Tide', 'Last Ration', 'The Thaw', 'No Signal',
      'Nightfall', 'Boil The Water', 'Day Ninety', 'The Last Match', 'Salt And Rope',
      'Nobody Is Coming',
    ],
  },
  racer: {
    nouns: [
      'Kart', 'Drift', 'Turbo', 'Circuit', 'Nitro', 'Overdrive', 'Rally', 'Speedway',
      'Grand Prix', 'Slipstream', 'Piston', 'Chicane', 'Apex', 'Redline', 'Gearbox',
      'Tarmac', 'Podium', 'Downforce', 'Paddock', 'Hairpin', 'Burnout', 'Clutch',
      'Marshal', 'Qualifier',
    ],
    heads: ['Kart', 'Racer', 'Rally', 'Challenge', 'Championship', 'Sprint'],
    subtitles: [
      'Full Throttle', 'Photo Finish', 'Night Circuit', 'Wet Track', 'Final Lap',
      'Pole Position', 'Yellow Flag', 'Pit Window', 'Two Seconds Back',
      'The Long Straight', 'Tyre Gamble', 'Podium Or Nothing',
    ],
  },
  puzzle: {
    nouns: [
      'Gem', 'Match', 'Cube', 'Tangle', 'Prism', 'Tetra', 'Mosaic', 'Riddle',
      'Knot', 'Loop', 'Jewel', 'Cipher', 'Lattice', 'Tessera', 'Pivot', 'Clockwork',
      'Domino', 'Hexagon', 'Bauble', 'Conundrum', 'Quandary', 'Mirror', 'Chime', 'Nonogram',
    ],
    heads: ['Puzzle', 'Cascade', 'Shift', 'Match', 'Machine', 'Rooms'],
    subtitles: [
      'Tilt', 'Chroma', 'Fold', 'Cascade', 'Rotation', 'Daily Challenge', 'Three Stars',
      'Move Limit', 'The Blue Set', 'Undo', 'Hint Tokens', 'One Hundred Rooms',
    ],
  },
  platformer: {
    nouns: [
      'Hop', 'Bounce', 'Jump', 'Spring', 'Blob', 'Leap', 'Skip', 'Tumble',
      'Cliff', 'Ledge', 'Pogo', 'Scamper', 'Somersault', 'Trampoline', 'Gumdrop',
      'Ramble', 'Clamber', 'Wobble', 'Sprocket', 'Cavern', 'Rooftop', 'Balloon',
      'Chute', 'Cartwheel',
    ],
    heads: ['Adventure', 'Dash', 'Rush', 'Land', 'Island', 'Quest'],
    subtitles: [
      'Double Jump', 'Sky Islands', 'The Long Fall', 'Coin Rush', 'Wall Kick',
      'World 1-1', 'Secret Exit', 'Warp Zone', 'One Hundred Coins', 'The Springy Bit',
      'Checkpoint', 'Cloud Nine',
    ],
  },
  horror: {
    nouns: [
      'Manor', 'Asylum', 'Basement', 'Whisper', 'Ghost', 'Séance', 'Morgue', 'Lantern',
      'Attic', 'Grave', 'Shade', 'Vigil', 'Hollow', 'Parish', 'Wake', 'Chapel',
      'Effigy', 'Lullaby', 'Doll', 'Corridor', 'Static', 'Revenant', 'Sanatorium', 'Crawlspace',
    ],
    heads: ['Manor', 'House', 'Vigil', 'Hours', 'Chapel', 'Asylum'],
    subtitles: [
      'Don’t Look Up', 'The Basement Tapes', 'Lights Out', 'Second Sight', 'Whispering',
      'Found Footage', 'The Quiet Hour', 'Nobody Left', 'Tape Three', 'Do Not Sleep',
      'The Long Night', 'It Knows',
    ],
  },
  farming: {
    nouns: [
      'Harvest', 'Orchard', 'Barn', 'Meadow', 'Acre', 'Pumpkin', 'Seedling', 'Sprout',
      'Furrow', 'Hayloft', 'Pasture', 'Windmill', 'Preserve', 'Almanac', 'Beehive',
      'Cider', 'Greenhouse', 'Smallholding', 'Turnip', 'Creamery', 'Allotment',
      'Scarecrow', 'Silo', 'Paddock',
    ],
    heads: ['Valley', 'Farm', 'Acres', 'Village', 'Story', 'Days'],
    subtitles: [
      'Second Harvest', 'Slow Season', 'The Big Pumpkin', 'Rain Comes', 'Fallow',
      'Market Day', 'First Frost', 'The Bee Year', 'Jam Season', 'Neighbours',
      'A Good Spring', 'Everything Grows',
    ],
  },
}

/**
 * Rule 1 — the plural table.
 *
 * A noun is in here **only if a title can plausibly count it**. *Chasing
 * Hexes* is a game; *Chasing Thunders* is a typo, and *Escaping Overdrives* is
 * not English at all, so `Thunder` and `Overdrive` are simply absent and the
 * gerund form declines to use them. That is the whole of the rule: the table
 * is the list of nouns the form may take, and the plural is what it takes.
 */
const PLURALS: Record<string, string> = {
  // arcade
  Comet: 'Comets', Orbit: 'Orbits', Blaster: 'Blasters', Meteor: 'Meteors',
  Rocket: 'Rockets', Pixel: 'Pixels', Asteroid: 'Asteroids', Laser: 'Lasers',
  Satellite: 'Satellites', Shuttle: 'Shuttles', Zapper: 'Zappers', Nova: 'Novas',
  Vector: 'Vectors', Quasar: 'Quasars', Photon: 'Photons', Bumper: 'Bumpers',
  Cannon: 'Cannons', Drone: 'Drones', Grid: 'Grids', Pulsar: 'Pulsars',
  Turret: 'Turrets', Zenith: 'Zeniths',
  // roguelike
  Dungeon: 'Dungeons', Crypt: 'Crypts', Deck: 'Decks', Labyrinth: 'Labyrinths',
  Catacomb: 'Catacombs', Gambit: 'Gambits', Relic: 'Relics', Vault: 'Vaults',
  Rune: 'Runes', Hex: 'Hexes', Oubliette: 'Oubliettes', Sigil: 'Sigils',
  Warren: 'Warrens', Cellar: 'Cellars', Tomb: 'Tombs', Spire: 'Spires',
  Cairn: 'Cairns', Wager: 'Wagers', Threshold: 'Thresholds',
  Undercroft: 'Undercrofts', Talisman: 'Talismans', Gauntlet: 'Gauntlets',
  // rpg
  Blade: 'Blades', Kingdom: 'Kingdoms', Dragon: 'Dragons', Quest: 'Quests',
  Knight: 'Knights', Sword: 'Swords', Prophecy: 'Prophecies', Throne: 'Thrones',
  Oath: 'Oaths', Realm: 'Realms', Wyrm: 'Wyrms', Saga: 'Sagas',
  Banner: 'Banners', Chronicle: 'Chronicles', Herald: 'Heralds',
  Covenant: 'Covenants', Warden: 'Wardens', Crown: 'Crowns',
  Sentinel: 'Sentinels', Lament: 'Laments', Vow: 'Vows', Pilgrim: 'Pilgrims',
  Bastion: 'Bastions', Grimoire: 'Grimoires',
  // tycoon
  Tycoon: 'Tycoons', Empire: 'Empires', Ledger: 'Ledgers',
  Spreadsheet: 'Spreadsheets', Merchant: 'Merchants', Factory: 'Factories',
  Franchise: 'Franchises', Mogul: 'Moguls', Warehouse: 'Warehouses',
  Enterprise: 'Enterprises', Monopoly: 'Monopolies', Boardroom: 'Boardrooms',
  Portfolio: 'Portfolios', Syndicate: 'Syndicates', Depot: 'Depots',
  Margin: 'Margins', Dividend: 'Dividends', Baron: 'Barons', Cartel: 'Cartels',
  Holding: 'Holdings',
  // survival
  Island: 'Islands', Bunker: 'Bunkers', Frontier: 'Frontiers',
  Outpost: 'Outposts', Colony: 'Colonies', Wasteland: 'Wastelands',
  Homestead: 'Homesteads', Shelter: 'Shelters', Expedition: 'Expeditions',
  Raft: 'Rafts', Ration: 'Rations', Signal: 'Signals', Beacon: 'Beacons',
  Foothold: 'Footholds', Provision: 'Provisions', Stockpile: 'Stockpiles',
  Treeline: 'Treelines',
  // racer
  Kart: 'Karts', Circuit: 'Circuits', Rally: 'Rallies', Speedway: 'Speedways',
  Piston: 'Pistons', Chicane: 'Chicanes', Gearbox: 'Gearboxes',
  Podium: 'Podiums', Paddock: 'Paddocks', Hairpin: 'Hairpins',
  Burnout: 'Burnouts', Clutch: 'Clutches', Marshal: 'Marshals',
  Qualifier: 'Qualifiers',
  // puzzle
  Gem: 'Gems', Cube: 'Cubes', Tangle: 'Tangles', Prism: 'Prisms',
  Mosaic: 'Mosaics', Riddle: 'Riddles', Knot: 'Knots', Loop: 'Loops',
  Jewel: 'Jewels', Cipher: 'Ciphers', Lattice: 'Lattices', Tessera: 'Tesserae',
  Clockwork: 'Clockworks', Domino: 'Dominoes', Hexagon: 'Hexagons',
  Bauble: 'Baubles', Conundrum: 'Conundrums', Quandary: 'Quandaries',
  Mirror: 'Mirrors', Chime: 'Chimes', Nonogram: 'Nonograms',
  // platformer
  Blob: 'Blobs', Cliff: 'Cliffs', Ledge: 'Ledges', Pogo: 'Pogos',
  Somersault: 'Somersaults', Trampoline: 'Trampolines', Gumdrop: 'Gumdrops',
  Sprocket: 'Sprockets', Cavern: 'Caverns', Rooftop: 'Rooftops',
  Balloon: 'Balloons', Chute: 'Chutes', Cartwheel: 'Cartwheels',
  // horror
  Manor: 'Manors', Asylum: 'Asylums', Basement: 'Basements',
  Whisper: 'Whispers', Ghost: 'Ghosts', Séance: 'Séances', Morgue: 'Morgues',
  Lantern: 'Lanterns', Attic: 'Attics', Grave: 'Graves', Shade: 'Shades',
  Vigil: 'Vigils', Hollow: 'Hollows', Parish: 'Parishes', Chapel: 'Chapels',
  Effigy: 'Effigies', Lullaby: 'Lullabies', Doll: 'Dolls',
  Corridor: 'Corridors', Revenant: 'Revenants', Crawlspace: 'Crawlspaces',
  // farming
  Orchard: 'Orchards', Barn: 'Barns', Meadow: 'Meadows', Acre: 'Acres',
  Pumpkin: 'Pumpkins', Seedling: 'Seedlings', Sprout: 'Sprouts',
  Furrow: 'Furrows', Hayloft: 'Haylofts', Pasture: 'Pastures',
  Windmill: 'Windmills', Preserve: 'Preserves', Almanac: 'Almanacs',
  Beehive: 'Beehives', Greenhouse: 'Greenhouses',
  Smallholding: 'Smallholdings', Turnip: 'Turnips', Creamery: 'Creameries',
  Allotment: 'Allotments', Scarecrow: 'Scarecrows', Silo: 'Silos',
}

/** The plural of a noun, or `null` where the table declines to give one. */
export function pluralOf(noun: string): string | null {
  return PLURALS[noun] ?? null
}

/**
 * The subject nouns, per genre — published for the tests that pin rule 1.
 *
 * A plural rule can only be checked against the words it applies to, and the
 * naive `${noun}s` a table replaces is only nameable if the nouns are.
 */
export const GENRE_NOUNS: Record<Genre, readonly string[]> =
  Object.fromEntries(GENRES.map((g) => [g, WORDS[g].nouns])) as Record<Genre, readonly string[]>

/** The eleven forms. See the table in the plan and the file header. */
type Form =
  | 'adj' | 'compound' | 'place' | 'subtitle' | 'gerund' | 'last'
  | 'possessive' | 'superlative' | 'amp' | 'bang'

/** Ordinal 0 sounds small: the two short forms and nothing else. */
const SHORT_FORMS: readonly Form[] = ['adj', 'compound']

/** `Super Pogo` belongs on a box with a sprite on it, not on a horror game. */
const SUPER_GENRES: readonly Genre[] = ['arcade', 'racer', 'platformer']
/** `Bounce!` likewise: the exclamation mark is an arcade convention. */
const BANG_GENRES: readonly Genre[] = ['arcade', 'platformer', 'puzzle']

const BASE_FORMS: readonly Form[] = [
  'adj', 'compound', 'place', 'subtitle', 'gerund', 'last', 'possessive', 'amp',
]

function formsFor(genre: Genre): readonly Form[] {
  const forms = [...BASE_FORMS]
  if (SUPER_GENRES.includes(genre)) forms.push('superlative')
  if (BANG_GENRES.includes(genre)) forms.push('bang')
  return forms
}

/** How often a title is the *Untitled … Game* joke. Never at ordinal 0. */
export const UNTITLED_CHANCE = 0.02
/** How often a title is a sequel of the one before it, past the second game. */
export const SEQUEL_CHANCE = 0.16
/** How often a title past the first carries a monetisation suffix. */
export const SUFFIX_CHANCE = 0.1

/**
 * Numerals by **chain depth**, so the first sequel is *II*.
 *
 * The draft indexed this by `depth + 1` against a table that already started at
 * *II*, and every chain in the game skipped a number: *Rusty Wasteland*,
 * *Rusty Wasteland III*. Rule 4 in the file header.
 */
const NUMERALS = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const

function numeral(depth: number): string {
  return depth < NUMERALS.length ? NUMERALS[depth] : String(depth + 1)
}

/**
 * Compose one original title. `pass` shifts every channel, which is how rule
 * 3's reroll gets a genuinely different name rather than the same one again.
 */
function compose(seed: number, ordinal: number, genre: Genre, pass: number): string {
  const d = (channel: number) => draw(seed, ordinal, channel + pass * CHANNEL_PASS)
  const words = WORDS[genre]
  const noun = pick(words.nouns, d(CH.noun))
  const form = pick(ordinal === 0 ? SHORT_FORMS : formsFor(genre), d(CH.form))

  switch (form) {
    case 'adj':
      return `${pick(ADJECTIVES, d(CH.adj))} ${noun}`
    case 'compound': {
      // Rule 2 — the second word is a head, never another subject noun.
      const heads = words.heads.filter((h) => h !== noun)
      return `${noun} ${pick(heads, d(CH.head))}`
    }
    case 'place':
      return `${noun} of ${pick(PLACES, d(CH.place))}`
    case 'subtitle':
      return `${noun}: ${pick(words.subtitles, d(CH.sub))}`
    case 'gerund': {
      // Rule 1 — only the nouns the table will pluralise, and the form is
      // skipped rather than fudged when this genre's roll lands on one of the
      // few that it will not.
      const countable = words.nouns.filter((n) => PLURALS[n] !== undefined)
      if (countable.length === 0) return `${pick(ADJECTIVES, d(CH.adj))} ${noun}`
      const subject = pick(countable, d(CH.plural))
      return `${pick(GERUNDS, d(CH.verb))} ${PLURALS[subject]}`
    }
    case 'last':
      return `The Last ${noun}`
    case 'possessive':
      return `${pick(POSSESSIVES, d(CH.possessive))} ${noun}`
    case 'superlative':
      return `${pick(SUPERLATIVES, d(CH.superlative))} ${noun}`
    case 'amp': {
      const others = words.nouns.filter((n) => n !== noun)
      return `${noun} & ${pick(others, d(CH.amp))}`
    }
    case 'bang':
      return `${noun}!`
  }
}

/** The sequel forms, by what they do to the base. */
function sequelName(seed: number, ordinal: number, base: string, genre: Genre, depth: number): string {
  const d = (channel: number) => draw(seed, ordinal, channel)
  const sub = pick(WORDS[genre].subtitles, d(CH.sub))
  // A base that already carries a colon does not get a second one.
  const plain = !base.includes(':')
  /*
   * *Returns*, *Zero* and *Origins* are each a thing that happens **once to a
   * series**: a franchise does not come back twice, and a prequel to a prequel
   * is a numeral with extra steps. Past the first sequel the chain climbs.
   */
  const forms = depth === 1
    ? (plain ? ['numeral', 'numeral-sub', 'sub', 'returns', 'zero', 'origins'] : ['numeral', 'returns', 'zero'])
    : (plain ? ['numeral', 'numeral-sub', 'sub'] : ['numeral'])
  switch (pick(forms, d(CH.sequelForm))) {
    case 'numeral-sub': return `${base} ${numeral(depth)}: ${sub}`
    case 'sub': return `${base}: ${sub}`
    case 'returns': return `${base} Returns`
    case 'zero': return `${base} Zero`
    case 'origins': return `${base} Origins`
    default: return `${base} ${numeral(depth)}`
  }
}

/** One title, given what the catalogue already holds. Pure in its arguments. */
function titleAt(seed: number, ordinal: number, previous: Title | null, window: readonly string[]): Title {
  const d = (channel: number) => draw(seed, ordinal, channel)
  // A sequel is decided before the original is rolled, and reads the title
  // before it, so a chain keeps one base and climbs one numeral at a time.
  if (previous && ordinal >= 2 && d(CH.sequel) < SEQUEL_CHANCE) {
    const depth = previous.sequel + 1
    const name = sequelName(seed, ordinal, previous.base, previous.genre, depth)
    return withSuffix(seed, ordinal, { name, genre: previous.genre, base: previous.base, sequel: depth })
  }

  const genre = pick(GENRES, d(CH.genre))
  /*
   * Rule 3 — a name the shelf still remembers rerolls its form on a second
   * channel rather than being accepted or truncated.
   *
   * **The joke form is inside the rule, not beside it.** *Untitled Racing
   * Game* was rolled before the window was consulted, and there are only ten
   * of them: at two per cent over ten genres a long career put the same one on
   * the wall twice inside a dozen releases, which is the exact thing the
   * window exists to stop and the one place it would be most noticeable.
   */
  const untitled = ordinal > 0 && d(CH.untitled) < UNTITLED_CHANCE
    ? `Untitled ${GENRE_LABEL[genre]} Game`
    : null
  let base = untitled ?? compose(seed, ordinal, genre, 0)
  if (window.includes(base)) base = compose(seed, ordinal, genre, untitled ? 0 : 1)
  return withSuffix(seed, ordinal, { name: base, genre, base, sequel: 0 })
}

/** §1's joke, one bracket at a time. Never on the first game; never over the cap. */
function withSuffix(seed: number, ordinal: number, title: Title): Title {
  const d = (channel: number) => draw(seed, ordinal, channel)
  let name = title.name
  if (ordinal >= 1 && d(CH.suffix) < SUFFIX_CHANCE) {
    const withIt = `${name} ${pick(SUFFIXES, d(CH.suffixPick))}`
    if (withIt.length <= MAX_TITLE_LENGTH) name = withIt
  }
  if (name.length > MAX_TITLE_LENGTH) {
    /*
     * The colon, possessive and "of" forms can all run long against a long
     * noun. Falling back to the two shortest words the grammar has is the only
     * option that does not truncate a title mid-word — a game called *The
     * Beekeeper's Smallholdi…* is worse than a game called *Quiet Barn*.
     */
    const short = `${pick(ADJECTIVES, d(CH.adj))} ${pick(WORDS[title.genre].nouns, d(CH.noun))}`
    return { name: short, genre: title.genre, base: short, sequel: 0 }
  }
  return { ...title, name }
}

/**
 * The catalogue up to and including `ordinal`, memoised per seed.
 *
 * Built forwards because both the sequel chain and rule 3's window are defined
 * against the titles *before* — which is the price of a catalogue that reads
 * like one studio's rather than like a random-name generator's. The cost is
 * one pass over the run's own releases, and the cache is what keeps the HUD's
 * hundred-millisecond redraw from paying it again every time.
 */
const cache = new Map<number, Title[]>()
/** Seeds kept before the cache is dropped. A run has one; the gallery has one. */
const CACHE_SEEDS = 8

function catalogue(seed: number, ordinal: number): Title[] {
  let list = cache.get(seed)
  if (!list) {
    if (cache.size >= CACHE_SEEDS) cache.clear()
    list = []
    cache.set(seed, list)
  }
  for (let o = list.length; o <= ordinal; o++) {
    const window = list.slice(Math.max(0, o - TITLE_WINDOW)).map((t) => t.name)
    list.push(titleAt(seed, o, list[o - 1] ?? null, window))
  }
  return list
}

/**
 * The title of release `ordinal` in a run — GDD §10.6.1.
 *
 * Deterministic in `(seed, ordinal)` and total for any ordinal: the gallery
 * relies on it, because a release record with no name is a row it cannot draw.
 */
export function titleFor(seed: number, ordinal: number): Title {
  const o = Math.max(0, Math.floor(Number.isFinite(ordinal) ? ordinal : 0))
  // Past the chain limit a title is rolled on its own — see CHAIN_LIMIT.
  if (o > CHAIN_LIMIT) return titleAt(seed, o, null, [])
  return catalogue(seed, o)[o]
}

/**
 * The genre a name states, for records written before titles carried one.
 *
 * `sim/cover.ts` used to regex the ladder's names for "flappy" and so on; a
 * release record from that era has a name and no genre. This is the honest
 * reading of such a name — a word match where there is one, and null where
 * there is not, so the caller can fall back to a seeded pick rather than to
 * a wrong certainty.
 */
export function genreNamed(name: string): Genre | null {
  const lower = name.toLowerCase()
  for (const genre of GENRES) {
    if (WORDS[genre].nouns.some((n) => lower.includes(n.toLowerCase()))) return genre
  }
  if (/flappy|arcade|endless/.test(lower)) return 'arcade'
  if (/rogue|dungeon/.test(lower)) return 'roguelike'
  if (/rpg|quest|dragon/.test(lower)) return 'rpg'
  if (/tycoon|manage|spreadsheet/.test(lower)) return 'tycoon'
  if (/survival|craft|open.?world/.test(lower)) return 'survival'
  if (/racer|kart/.test(lower)) return 'racer'
  if (/puzzle|match/.test(lower)) return 'puzzle'
  if (/platform|jump/.test(lower)) return 'platformer'
  if (/horror|haunt|ghost/.test(lower)) return 'horror'
  if (/farm|harvest/.test(lower)) return 'farming'
  return null
}
