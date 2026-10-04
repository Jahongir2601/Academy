// Kampus ma’lumotlari — B layout (konsepsiya + tasdiqlangan o‘zgartirishlar).
//
// Koordinatalar metrda. Uchastka markazi (0, 0).
//   x  → sharq (+) / g‘arb (−)
//   z  → janub (+) / shimol (−)   (Ceremonial Entrance janubda, z ≈ +150)
//   y  → balandlik
// rect = [x0, x1, z0, z1], bunda z0 — shimoliy chet, z1 — janubiy chet.
//
// Konsepsiya o‘zgarsa, shu faylni tahrirlash kifoya: maket, maydon jadvali,
// xavfsizlik ringlari va ma’lumot kartalari shu yerdan quriladi.

export type Ring = 1 | 2 | 3;
export type Rect = [number, number, number, number];

export type AreaCategory =
  | 'academic'
  | 'research'
  | 'conference'
  | 'datasim'
  | 'knowledge'
  | 'residence'
  | 'admin';

export type FacadeStyle =
  | 'grandHall'
  | 'knowledge'
  | 'academic'
  | 'doctoral'
  | 'simulation'
  | 'datalab'
  | 'secure'
  | 'research'
  | 'conference'
  | 'museum'
  | 'residence'
  | 'club'
  | 'admin'
  | 'energy';

export interface BuildingDef {
  id: string;
  /** Konsepsiyadagi zona raqami (3-bo‘lim ro‘yxati). */
  no: number;
  /** Bitta zona ikki binoga bo‘lingan bo‘lsa — harf (5a / 5b). */
  sub?: string;
  name: string;
  nameUz: string;
  ring: Ring;
  category: AreaCategory;
  rect: Rect;
  floors: number;
  /** Qavat balandligi, m. */
  floorH: number;
  /** Ichki hovli (GFA dan ayiriladi). */
  court?: Rect;
  /** Maxsus hajmlar uchun qo‘lda berilgan umumiy maydon, m². */
  gfa?: number;
  style: FacadeStyle;
  capacity?: string;
  summary: string;
  items: string[];
  interior?: 'grandHall' | 'mpc';
}

export interface ZoneDef {
  id: string;
  no: number;
  name: string;
  nameUz: string;
  ring: Ring;
  rect: Rect;
  summary: string;
  items: string[];
}

export const SITE = {
  rect: [-190, 190, -150, 150] as Rect,
  /** Toshkent markazi (uchastka aniq emas — umumiy tekis maydon). */
  lat: 41.3111,
  lon: 69.2797,
  utcOffset: 5,
};

export const COURTYARD: Rect = [-40, 40, -32, 28];

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'grandHall',
    no: 1,
    name: 'Grand Academy Hall',
    nameUz: 'Asosiy kirish va ramziy markaz',
    ring: 1,
    category: 'admin',
    rect: [-28, 28, 50, 98],
    floors: 1,
    floorH: 22,
    gfa: 3100,
    style: 'grandHall',
    capacity: 'Delegatsiyalarni kutib olish, visitor lounge',
    summary:
      'Akademiyaning monumental kirishi. 20 metrli atrium shimol tomonda Knowledge Stair orqali Knowledge Centre’ga ko‘tariladi.',
    items: [
      '20 m baland atrium, yuqoridan tabiiy yorug‘lik',
      'Simmetrik ceremonial kirish va portik',
      'Real-time iqtisodiy ko‘rsatkichlar digital wall',
      'O‘zbekiston puli va Markaziy bank tarixi',
      'Knowledge Stair — zina, o‘tirish joyi, qisqa ma’ruzalar',
      'Reception, visitor information, public café',
    ],
    interior: 'grandHall',
  },
  {
    id: 'knowledge',
    no: 3,
    name: 'Knowledge Centre',
    nameUz: 'Intellektual markaz — kutubxona',
    ring: 2,
    category: 'knowledge',
    rect: [-26, 26, 30, 50],
    floors: 3,
    floorH: 5,
    style: 'knowledge',
    capacity: '3 qavatli ochiq kutubxona',
    summary:
      'Bosh o‘qda, Grand Hall bilan Courtyard orasida. Shimoliy fasadi to‘liq hovliga ochiladi — kampusning eng ko‘rinadigan bilim makoni.',
    items: [
      'Economics, finance, central banking, statistics, data science fondi',
      'Bloomberg / Refinitiv terminallari',
      'Individual study pods va group study rooms',
      '24/7 study zone',
      'Rare books / archive room',
      'Research help desk',
    ],
  },
  {
    id: 'academic',
    no: 2,
    name: 'Academic Core',
    nameUz: 'Professional ta’lim markazi',
    ring: 2,
    category: 'academic',
    rect: [-96, -40, -40, 18],
    floors: 4,
    floorH: 4.2,
    court: [-80, -56, -24, 2],
    style: 'academic',
    capacity: '300 tinglovchi bir vaqtda',
    summary:
      'Hovlining g‘arbiy qanoti. Ichida o‘zining kichik hovlisi bor — yozda soyali tanaffus joyi.',
    items: [
      '8 ta 24–30 kishilik case-study classroom (U-shape)',
      '4 ta 50–60 kishilik flexible classroom',
      '2 ta 100–120 kishilik transformable lecture room',
      '4 ta executive classroom (boardroom)',
      '6–8 ta small-group discussion room',
      'Student lounge, breakout areas, faculty preparation',
    ],
  },
  {
    id: 'doctoral',
    no: 7,
    name: 'Doctoral & Academic Centre',
    nameUz: 'PhD himoyasi va akademik faoliyat',
    ring: 2,
    category: 'academic',
    rect: [-64, -40, 22, 52],
    floors: 2,
    floorH: 6,
    style: 'doctoral',
    capacity: '2 × 70–100 kishilik PhD Defence Hall',
    summary:
      'Museum bilan Academic Core oralig‘ida — yarim ommaviy himoyalar uchun qulay joy, alohida kirish bilan.',
    items: [
      '2 ta PhD Defence Hall (recording, livestream)',
      'Committee room',
      'Candidate preparation room',
      'Faculty lounge',
      'Small seminar rooms, archive',
      'Academic administration',
    ],
  },
  {
    id: 'simulation',
    no: 4,
    name: 'Central Banking Simulation Centre',
    nameUz: 'Flagship simulyatsiya markazi',
    ring: 2,
    category: 'datasim',
    rect: [40, 64, -2, 30],
    floors: 2,
    floorH: 6,
    style: 'simulation',
    capacity: 'MPC xonasi + Crisis xonasi',
    summary:
      'Monetary Policy Committee va moliyaviy inqiroz simulyatsiyalari. Ikki qavat balandlikdagi xonalar, control room va visualization wall.',
    items: [
      'MPC Simulation Room — oval stol, shaxsiy monitorlar',
      'Main visualization wall, real-time data feed',
      'Policy shock engine, video recording',
      'Financial Crisis Simulation Room — 6 jamoa',
      'Ssenariylar: bank run, FX pressure, cyber disruption',
      'Control room',
    ],
    interior: 'mpc',
  },
  {
    id: 'datalab',
    no: 5,
    sub: 'a',
    name: 'Data, AI & Innovation Centre',
    nameUz: 'Data Lab · AI Lab · Fintech & CBDC Lab',
    ring: 2,
    category: 'datasim',
    rect: [40, 64, -36, -2],
    floors: 2,
    floorH: 5,
    style: 'datalab',
    capacity: '60 workstation',
    summary:
      'Ochiq laboratoriyalar Ring 2 da. Maxfiy ma’lumotlar bilan ishlash Ring 3 dagi Secure Data Lab’ga ajratilgan (3-taklif).',
    items: [
      'Data Lab — 60 workstation (Python, R, Matlab, Stata, EViews)',
      'AI Lab — ML, NLP, LLM, inflation nowcasting',
      'Fintech & CBDC Lab — SupTech, RegTech, tokenization',
      'Visualization Wall — financial stability monitoring',
    ],
  },
  {
    id: 'secure',
    no: 5,
    sub: 'b',
    name: 'Secure Data Lab + Data Centre',
    nameUz: 'Maxfiy mikroma’lumotlar laboratoriyasi',
    ring: 3,
    category: 'datasim',
    rect: [20, 50, -90, -64],
    floors: 2,
    floorH: 5,
    style: 'secure',
    capacity: 'Badge-controlled',
    summary:
      'Data, AI & Innovation Centre’ning yuqori xavfsizlik qismi. Research Institute yonida, Ring 3 to‘sig‘i ichida.',
    items: [
      'Secure Microdata Lab — izolyatsiyalangan muhit',
      'Bank-level va mikroma’lumotlar bilan ishlash',
      'Restricted internet, secure export procedure',
      'Monitoring va audit logging',
      'Data centre va IT infratuzilma',
    ],
  },
  {
    id: 'research',
    no: 6,
    name: 'Research Institute',
    nameUz: 'Ilmiy tadqiqot qanoti',
    ring: 3,
    category: 'research',
    rect: [-90, -30, -104, -56],
    floors: 3,
    floorH: 4.2,
    court: [-74, -46, -90, -70],
    style: 'research',
    capacity: '80–120 researcher / faculty',
    summary:
      'Sokin va professional muhit. Ichki hovli atrofida joylashgan, orqasida Scholars’ Garden.',
    items: [
      '1–2 kishilik researcher offices',
      '4–6 kishilik project rooms',
      'Visiting scholar offices',
      'Seminar rooms, econometrics room, quiet rooms',
      'Publication / editing office',
      'Research Commons — coffee, whiteboards, lounge',
    ],
  },
  {
    id: 'conference',
    no: 8,
    name: 'International Conference Centre',
    nameUz: 'Xalqaro konferensiya markazi',
    ring: 1,
    category: 'conference',
    rect: [40, 112, 46, 98],
    floors: 2,
    floorH: 5.5,
    gfa: 5600,
    style: 'conference',
    capacity: '500 kishilik asosiy auditorium',
    summary:
      'Grand Hall’ning sharqiy yonida, alohida kirish va VIP kirish bilan (1-taklif). Konferensiya kunlari akademik o‘q band bo‘lmaydi.',
    items: [
      'Main Auditorium — 450–500 o‘rin, LED wall',
      '4–6 interpreter booth, broadcast cameras',
      '2 × 120 kishilik secondary hall (birlashadi → 240)',
      '6–8 breakout room (20–40 kishi)',
      'VIP backstage, press room, protocol room',
      'Alohida konferensiya kirishi va VIP drop-off',
    ],
  },
  {
    id: 'museum',
    no: 9,
    name: 'Central Bank Museum',
    nameUz: 'Interaktiv iqtisodiyot muzeyi',
    ring: 1,
    category: 'knowledge',
    rect: [-92, -40, 64, 98],
    floors: 1,
    floorH: 10,
    style: 'museum',
    capacity: 'Ommaviy zona',
    summary:
      'Grand Hall’ning g‘arbiy yonida, forecourt’dan to‘g‘ridan-to‘g‘ri kiriladi. Oddiy ekspozitsiya emas, interaktiv tajriba.',
    items: [
      'History of Money — tangalar, banknotalar, islohotlar',
      'Inflation Room — interaktiv simulyatsiya',
      'Monetary Policy Game',
      'Bank Run Simulator',
      'Design Your Banknote',
      'Central Banking Explained',
    ],
  },
  {
    id: 'residence',
    no: 12,
    name: 'Academy Residence',
    nameUz: 'Mehmonxona — 4-star business',
    ring: 2,
    category: 'residence',
    rect: [10, 120, -140, -124],
    floors: 4,
    floorH: 3.6,
    style: 'residence',
    capacity: '~140 xona',
    summary:
      'Kampus shimolida, bog‘ yonida. Mehmonlar shimoli-sharqdagi alohida yo‘l orqali keladi (6-taklif).',
    items: [
      '100 standard guest rooms',
      '25 executive rooms',
      '10 visiting-professor apartments',
      '5 VIP suites',
      'Breakfast area, business centre, laundry',
      'Long-stay kitchenette, garden access',
    ],
  },
  {
    id: 'club',
    no: 13,
    name: 'Academy Club',
    nameUz: 'Restoran, sport va wellness',
    ring: 2,
    category: 'residence',
    rect: [124, 172, -140, -100],
    floors: 2,
    floorH: 5,
    // 2 qavatli asosiy blok (48×26) + bir qavatli baland basseyn zali (48×14)
    gfa: 3168,
    style: 'club',
    capacity: 'Restaurant · café · pool',
    summary: 'Residence bilan bevosita bog‘langan networking va dam olish markazi.',
    items: [
      'Restaurant va café',
      'Gym, indoor pool, sauna',
      'Wellness rooms',
      'Padel / tennis courts',
      'Jogging track',
      'Informal networking lounge',
    ],
  },
  {
    id: 'admin',
    no: 14,
    sub: 'a',
    name: 'Administration',
    nameUz: 'Ma’muriyat',
    ring: 2,
    category: 'admin',
    rect: [88, 132, -6, 14],
    floors: 3,
    floorH: 4,
    style: 'admin',
    summary: 'Akademiya ma’muriyati. Xizmat kirishi yonida.',
    items: ['Rektorat va dasturlar boshqarmasi', 'Moliya va HR', 'Xalqaro aloqalar bo‘limi', 'Protokol xizmati'],
  },
  {
    id: 'energy',
    no: 14,
    sub: 'b',
    name: 'Technical & Energy Centre',
    nameUz: 'Texnik zona',
    ring: 2,
    category: 'admin',
    rect: [100, 140, -60, -34],
    floors: 1,
    floorH: 8,
    style: 'energy',
    summary: 'Muhandislik markazi: issiqlik-sovutish, smart building management, suv qayta ishlash.',
    items: [
      'High-efficiency HVAC markazi',
      'Smart building management (BMS)',
      'Grey-water reuse va rainwater harvesting',
      'Energy monitoring',
      'Tom ustida quyosh panellari',
    ],
  },
];

export const ZONES: ZoneDef[] = [
  {
    id: 'courtyard',
    no: 10,
    name: 'Academy Courtyard',
    nameUz: 'Kampusning markaziy hovlisi',
    ring: 2,
    rect: COURTYARD,
    summary:
      '80 × 60 m. Chorbog‘ g‘oyasining zamonaviy talqini: xoch shaklidagi suv havzasi, to‘rt bo‘lakda chinorlar, perimetr bo‘ylab ravoqlar (4-taklif).',
    items: [
      'Reflecting pool (xoch shaklida)',
      'Katta chinorlar — soya uchun',
      'Shaded arcades — perimetr bo‘ylab',
      'Coffee terrace (Knowledge Centre oldida)',
      'Outdoor seminar amfiteatri',
      'Evening lighting',
    ],
  },
  {
    id: 'scholars',
    no: 11,
    name: 'Scholars’ Garden',
    nameUz: 'Olimlar bog‘i',
    ring: 2,
    rect: [-176, 4, -146, -110],
    summary: 'Research Institute orqasidagi sokin bog‘: ariq, pavilonlar, zich daraxtzor.',
    items: [
      'Walking path',
      'Water feature — ariq va kichik havzalar',
      'Dense greenery',
      'Small pavilions (shiypon)',
      'Outdoor reading, quiet seating',
    ],
  },
  {
    id: 'parking',
    no: 15,
    name: 'Perimeter & Underground Parking',
    nameUz: 'Avtoturargoh',
    ring: 1,
    rect: [-180, -124, -20, 106],
    summary:
      'Jami ~445 joy: ~265 joy perimetrda quyosh panelli soyabonlar ostida, ~150 joy Conference Centre ostida yer osti, ~30 joy xizmat va Residence yonida (7-taklif).',
    items: [
      'Perimetr: ~265 joy, solar carport (~3 700 m² panel ≈ 0.75 MWp)',
      'Yer osti: ~150 joy (VIP va xodimlar)',
      'EV charging joylari',
      'Bicycle parking — Grand Hall oldida',
      'Ichki elektr shuttle yo‘li',
    ],
  },
];

export const AREA_TARGETS: Record<AreaCategory, { label: string; min: number; max: number }> = {
  academic: { label: 'Academic & Executive Education', min: 10000, max: 12000 },
  research: { label: 'Research Institute', min: 6000, max: 8000 },
  conference: { label: 'International Conference Centre', min: 5000, max: 6000 },
  datasim: { label: 'Data, AI & Simulation Centre', min: 4000, max: 5000 },
  knowledge: { label: 'Knowledge Centre + Museum', min: 4000, max: 5000 },
  residence: { label: 'Residence & Academy Club', min: 10000, max: 12000 },
  admin: { label: 'Administration / Support / Technical', min: 5000, max: 7000 },
};

export const RING_INFO: Record<Ring, { name: string; title: string; items: string[] }> = {
  1: {
    name: 'Ring 1',
    title: 'Public Zone',
    items: ['Grand Hall', 'Museum', 'Conference Centre', 'Forecourt, public café', 'Perimetr parking'],
  },
  2: {
    name: 'Ring 2',
    title: 'Academy Zone — badge',
    items: ['Classrooms, Knowledge Centre', 'Simulation rooms, Data Lab', 'Courtyard', 'Residence & Club'],
  },
  3: {
    name: 'Ring 3',
    title: 'Secure Research Zone',
    items: ['Research Institute', 'Secure Microdata Lab', 'Data centre, IT infratuzilma'],
  },
};

export function rectArea(r: Rect): number {
  return (r[1] - r[0]) * (r[3] - r[2]);
}

export function buildingGFA(b: BuildingDef): number {
  if (b.gfa) return b.gfa;
  const foot = rectArea(b.rect) - (b.court ? rectArea(b.court) : 0);
  return foot * b.floors;
}

export function buildingHeight(b: BuildingDef): number {
  return b.floors * b.floorH + 1.2;
}

export function rectCenter(r: Rect): [number, number] {
  return [(r[0] + r[1]) / 2, (r[2] + r[3]) / 2];
}

/** Belgidagi raqam: zona raqami va kerak bo‘lsa harf (5a, 14b). */
export const numLabel = (d: { no: number; sub?: string }) => `${d.no}${d.sub ?? ''}`;
