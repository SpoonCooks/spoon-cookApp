/**
 * The approved Figma scope, derived from the **V14** node tree.
 *
 * ## Provenance
 *
 * Read on 2026-08-25 from the **remote Figma MCP server** (`mcp.figma.com`) as
 * `lakshay58csea24@bpitindia.edu.in`, a Full seat. V13 had to go through the desktop Dev Mode
 * server because the remote one refused the older file; V14 needs no such workaround.
 *
 * Source: file `3iYf9ckrUDZLPlJP56dyKI` ("V0_-user-app--14-"), page `Cook App` = `434:2401`.
 * The verbatim `get_metadata` dump is committed at `docs/.figma-canvas-v14-434-2401.xml`, and
 * `scripts/visual/inventory.py` derives `docs/visual-verification/v14/inventory.json` from it.
 * The node data below is generated from that inventory, so it cannot drift from the design.
 *
 * The file has two pages. `0:1` ("User App") is the customer app and is **entirely out of
 * scope** — it is never read, so no User App frame can reach this file. The Cook App page is
 * the scope boundary.
 *
 * Scope rule: a screen counts **only if it is a direct child frame of one of the seven `SECTION`
 * nodes below**. Nested component frames and loose canvas frames are not screens.
 *
 * ## V13 to V14: 35 screens became 47
 *
 * The V13 inventory is not a safe starting point, and three of its assumptions had to be dropped:
 *
 *   - **`Service flow` was rebuilt from scratch.** All twelve V13 service node ids are absent
 *     from V14; thirteen new `614:*`/`622:*`/`628:*` frames stand in their place. The section
 *     also changed authoring convention — V13's frames were 390x830 with a decorative phone
 *     bezel, V14's are 371-wide `direct` frames. Inheriting the V13 viewport profile would
 *     displace every Service comparison before a single element was examined.
 *   - **`job flow` (`592:1070`) is now in scope.** V13 recorded it as finished-looking but
 *     excluded by brief. V14 finalizes it, so its five frames are required work.
 *   - **`Info` (`611:398`) is a new section** of six rule/penalty screens, reached from the new
 *     fifth bottom-nav tab (`Niyam`).
 *
 * The largest single change is structural rather than per-section: V14 adds a **68-unit five-tab
 * bottom nav** (`Hazri / Kaam / Chutti / Kamai / Niyam`) to 33 of the 47 frames. That accounts
 * for almost every geometry change among the 23 carried-over screens — fourteen of them are
 * exactly 68 units taller than their V13 selves and otherwise identical.
 *
 * Two carried-over `performance` frames changed by more than the nav and are real redesigns:
 * `575:1903` (+238) and `575:2032` (+219).
 *
 * ## Why `convention`, `statusBand` and `bottomNav` are per screen
 *
 * They decide how a frame is compared, and V14 makes all three frame-level rather than
 * section-level facts. `Info` is the proof: five of its frames draw the 36.198-unit hairline
 * status mock and `597:1131` draws the 32-unit `phone bar`, inside one section. A per-section
 * table would silently mis-align that frame.
 *
 * This file is data, not behaviour, so that `figmaScope.test.ts` can assert the implementation
 * covers the design rather than the other way round.
 */

export interface FigmaSection {
  readonly nodeId: string;
  readonly name: string;
}

/** How a frame relates to the application viewport, and what chrome it draws. */
export type ViewportConvention = 'bezel' | 'direct';

export interface FigmaScreen {
  readonly nodeId: string;
  readonly name: string;
  readonly sectionNodeId: string;
  /** `bezel` frames wrap the viewport in a decorative 390x830 phone mockup; `direct` frames are it. */
  readonly convention: ViewportConvention;
  /** Height of the status-bar mock this frame draws, in design units. Chrome; the app never draws it. */
  readonly statusBand: number;
  /** Whether this frame carries the V14 five-tab bottom nav (68 units). */
  readonly bottomNav: boolean;
  readonly width: number;
  readonly height: number;
  /** Where this frame is implemented, or the state that renders it. */
  readonly implementation: string;
  /** The gallery state id that opens this exact frame in the development gallery. */
  readonly galleryState: string;
}

/** The seven finalized V14 sections. Names are literal: `Login flow` is not `log in flow`. */
export const figmaSections: readonly FigmaSection[] = [
  { nodeId: '434:3115', name: 'Login flow' },
  { nodeId: '592:1068', name: 'log in flow' },
  { nodeId: '540:416', name: 'leave' },
  { nodeId: '575:1741', name: 'performance' },
  { nodeId: '592:1070', name: 'job flow' },
  { nodeId: '485:4971', name: 'Service flow' },
  { nodeId: '611:398', name: 'Info' },
];

/**
 * Every direct-child frame of a finalized section. **47 total: 5 + 4 + 7 + 7 + 5 + 13 + 6.**
 *
 * The count comes from V14 itself, not from V13's 35. Several frames are STATES of one route
 * rather than separate routes — the thirteen service frames are thirteen renderings of one
 * booking, which is what lets the app reconcile after a restart instead of landing on a stale
 * screen.
 */
export const figmaScreens: readonly FigmaScreen[] = [
  /* ---- Login flow (434:3115) — 5 ---- */
  {
    nodeId: '434:3116',
    name: 'Page 2c- OTP wrong',
    sectionNodeId: '434:3115',
    convention: 'bezel',
    statusBand: 33,
    bottomNav: false,
    width: 390,
    height: 830,
    implementation: 'src/app/otp.tsx — error state',
    galleryState: 'login/otp-wrong',
  },
  {
    nodeId: '434:3174',
    name: 'Page 2b- OTP resend',
    sectionNodeId: '434:3115',
    convention: 'bezel',
    statusBand: 33,
    bottomNav: false,
    width: 390,
    height: 830,
    implementation: 'src/app/otp.tsx — resend-available state',
    galleryState: 'login/otp-resend',
  },
  {
    nodeId: '434:3224',
    name: 'Page 2a- Login OTP',
    sectionNodeId: '434:3115',
    convention: 'bezel',
    statusBand: 33,
    bottomNav: false,
    width: 390,
    height: 830,
    implementation: 'src/app/otp.tsx — countdown state',
    galleryState: 'login/otp-countdown',
  },
  {
    nodeId: '434:3280',
    name: 'Page 1- Login No.',
    sectionNodeId: '434:3115',
    convention: 'bezel',
    statusBand: 33,
    bottomNav: false,
    width: 390,
    height: 830,
    implementation: 'src/app/login.tsx',
    galleryState: 'login/phone',
  },
  {
    nodeId: '434:3330',
    name: 'Page 0- loading page',
    sectionNodeId: '434:3115',
    convention: 'bezel',
    statusBand: 33,
    bottomNav: false,
    width: 390,
    height: 830,
    implementation: 'src/app/index.tsx',
    galleryState: 'login/boot',
  },

  /* ---- log in flow (592:1068) — 4 ---- */
  {
    nodeId: '575:2135',
    name: '3a- daily log in',
    sectionNodeId: '592:1068',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370,
    height: 821,
    implementation: 'src/app/(tabs)/attendance.tsx — eligible, not yet marked',
    galleryState: 'login-flow/daily',
  },
  {
    nodeId: '575:2136',
    name: '3d- log out',
    sectionNodeId: '592:1068',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370,
    height: 821,
    implementation: 'src/app/(tabs)/attendance.tsx — shift finished',
    galleryState: 'login-flow/logout',
  },
  {
    nodeId: '575:2137',
    name: '3b- present',
    sectionNodeId: '592:1068',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370,
    height: 821,
    implementation: 'src/app/(tabs)/attendance.tsx — marked present',
    galleryState: 'login-flow/present',
  },
  {
    nodeId: '575:2138',
    name: '3c- absent',
    sectionNodeId: '592:1068',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370,
    height: 821,
    implementation: 'src/app/(tabs)/attendance.tsx — absent',
    galleryState: 'login-flow/absent',
  },

  /* ---- leave (540:416) — 7 ---- */
  {
    nodeId: '592:1008',
    name: 'long leave confirm',
    sectionNodeId: '540:416',
    convention: 'direct',
    statusBand: 36.198,
    bottomNav: true,
    width: 371,
    height: 950.1983,
    implementation: 'src/app/(tabs)/chutti.tsx — single-day leave applied AND long leave booked',
    galleryState: 'leave/applied-and-booked',
  },
  {
    nodeId: '592:488',
    name: 'Leave present',
    sectionNodeId: '540:416',
    convention: 'direct',
    statusBand: 36.198,
    bottomNav: true,
    width: 371,
    height: 814,
    implementation: 'src/app/(tabs)/chutti.tsx — cook present today (AAJ KA BREAK card shown)',
    galleryState: 'leave/present',
  },
  {
    nodeId: '592:489',
    name: 'Leave absent',
    sectionNodeId: '540:416',
    convention: 'direct',
    statusBand: 36.198,
    bottomNav: true,
    width: 371,
    height: 814,
    implementation: 'src/app/(tabs)/chutti.tsx — cook not working today',
    galleryState: 'leave/absent',
  },
  {
    nodeId: '592:563',
    name: 'long leave',
    sectionNodeId: '540:416',
    convention: 'direct',
    statusBand: 36.198,
    bottomNav: false,
    width: 371,
    height: 882.1983,
    implementation: 'src/app/leave/range.tsx — no dates selected',
    galleryState: 'leave/long-empty',
  },
  {
    nodeId: '592:639',
    name: 'long leave selected',
    sectionNodeId: '540:416',
    convention: 'direct',
    statusBand: 36.198,
    bottomNav: false,
    width: 371,
    height: 882.1983,
    implementation: 'src/app/leave/range.tsx — 16-25 Nov selected, Total din 10',
    galleryState: 'leave/long-selected',
  },
  {
    nodeId: '592:832',
    name: 'long leave confirm',
    sectionNodeId: '540:416',
    convention: 'direct',
    statusBand: 36.198,
    bottomNav: false,
    width: 371,
    height: 882.1983,
    implementation: 'src/app/(tabs)/chutti.tsx — long leave booked, no single-day leave',
    galleryState: 'leave/long-booked',
  },
  {
    nodeId: '592:888',
    name: 'short leave',
    sectionNodeId: '540:416',
    convention: 'direct',
    statusBand: 36.198,
    bottomNav: false,
    width: 371,
    height: 882.2,
    implementation: 'src/app/leave/single.tsx — confirm sheet',
    galleryState: 'leave/short-confirm',
  },

  /* ---- performance (575:1741) — 7 ---- */
  {
    nodeId: '575:1744',
    name: '12- money daily',
    sectionNodeId: '575:1741',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370,
    height: 1116.0579,
    implementation: 'src/app/(tabs)/money.tsx — period=day',
    galleryState: 'performance/money-daily',
  },
  {
    nodeId: '575:1884',
    name: '13- money weekly',
    sectionNodeId: '575:1741',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370,
    height: 1326.28,
    implementation: 'src/app/(tabs)/money.tsx — period=cycle (sevenDay)',
    galleryState: 'performance/money-weekly',
  },
  {
    nodeId: '575:1903',
    name: '14- day history',
    sectionNodeId: '575:1741',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370.44,
    height: 798,
    implementation: 'src/app/money/days.tsx',
    galleryState: 'performance/day-history',
  },
  {
    nodeId: '575:1922',
    name: '15- past daily',
    sectionNodeId: '575:1741',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370,
    height: 1142.0579,
    implementation: 'src/app/money/day/[date].tsx',
    galleryState: 'performance/past-daily',
  },
  {
    nodeId: '575:2013',
    name: '16- money monthly',
    sectionNodeId: '575:1741',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370,
    height: 1158.4,
    implementation: 'src/app/(tabs)/money.tsx — period=month',
    galleryState: 'performance/money-monthly',
  },
  {
    nodeId: '575:2032',
    name: '17- weekly history',
    sectionNodeId: '575:1741',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370.44,
    height: 846,
    implementation: 'src/app/money/cycles.tsx',
    galleryState: 'performance/weekly-history',
  },
  {
    nodeId: '575:2098',
    name: '18- past weekly',
    sectionNodeId: '575:1741',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370,
    height: 1352.28,
    implementation: 'src/app/money/cycle/[cycleId].tsx',
    galleryState: 'performance/past-weekly',
  },

  /* ---- job flow (592:1070) — 5 ---- */
  {
    nodeId: '583:375',
    name: '4a- jobs log out',
    sectionNodeId: '592:1070',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370.44,
    height: 909.05,
    implementation: 'src/app/(tabs)/jobs.tsx — shift not started',
    galleryState: 'jobs/logged-out',
  },
  {
    nodeId: '583:401',
    name: '4b- job log in',
    sectionNodeId: '592:1070',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370.44,
    height: 1013.05,
    implementation: 'src/app/(tabs)/jobs.tsx — shift started, break card shown',
    galleryState: 'jobs/logged-in',
  },
  {
    nodeId: '583:427',
    name: '4c- next in <45 mins',
    sectionNodeId: '592:1070',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370.44,
    height: 1067.05,
    implementation: 'src/app/(tabs)/jobs.tsx — next job under 45 minutes away',
    galleryState: 'jobs/next-45',
  },
  {
    nodeId: '583:453',
    name: '4d- next <10 mins',
    sectionNodeId: '592:1070',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370.44,
    height: 1067.05,
    implementation: 'src/app/(tabs)/jobs.tsx — next job under 10 minutes away',
    galleryState: 'jobs/next-10',
  },
  {
    nodeId: '583:479',
    name: '4e- next <5 mins',
    sectionNodeId: '592:1070',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 370.44,
    height: 1067.05,
    implementation: 'src/app/(tabs)/jobs.tsx — next job under 5 minutes away',
    galleryState: 'jobs/next-5',
  },

  /* ---- Service flow (485:4971) — 13 ---- */
  {
    nodeId: '614:453',
    name: 'travel- on time',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 795,
    implementation: 'ServiceViews TravelView timing=on_time',
    galleryState: 'service/travel-on-time',
  },
  {
    nodeId: '622:1036',
    name: ' timer (hr + mins)',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 863,
    implementation: 'ServiceViews CookingView remaining >= 1 hour',
    galleryState: 'service/timer-hours',
  },
  {
    nodeId: '622:1085',
    name: 'timer (mins)',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 863,
    implementation: 'ServiceViews CookingView remaining in minutes',
    galleryState: 'service/timer-minutes',
  },
  {
    nodeId: '622:1125',
    name: 'timer (<7 mins)',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 863,
    implementation: 'ServiceViews CookingView remaining < 7 minutes',
    galleryState: 'service/timer-ending',
  },
  {
    nodeId: '622:1163',
    name: 'timer- extension',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 927,
    implementation: 'ServiceViews CookingView extension window open',
    galleryState: 'service/timer-extension',
  },
  {
    nodeId: '622:530',
    name: 'travel- late',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 863,
    implementation: 'ServiceViews TravelView timing=late',
    galleryState: 'service/travel-late',
  },
  {
    nodeId: '622:597',
    name: 'travel- edge',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 863,
    implementation: 'ServiceViews TravelView timing=at_risk',
    galleryState: 'service/travel-edge',
  },
  {
    nodeId: '622:664',
    name: 'arrival- on time',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 863,
    implementation: 'ServiceViews ArrivalView timing=on_time',
    galleryState: 'service/arrival-on-time',
  },
  {
    nodeId: '622:733',
    name: 'arrival- late',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 863,
    implementation: 'ServiceViews ArrivalView timing=late',
    galleryState: 'service/arrival-late',
  },
  {
    nodeId: '622:801',
    name: 'Start otp',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 986,
    implementation: 'ServiceViews StartOtpView',
    galleryState: 'service/start-otp',
  },
  {
    nodeId: '622:913',
    name: 'travel- cancel',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 863,
    implementation: 'ServiceViews TravelView cancelled/interrupted',
    galleryState: 'service/travel-cancel',
  },
  {
    nodeId: '628:1249',
    name: 'end otp',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 863,
    implementation: 'ServiceViews EndOtpView',
    galleryState: 'service/end-otp',
  },
  {
    nodeId: '628:1293',
    name: 'End',
    sectionNodeId: '485:4971',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 863,
    implementation: 'ServiceViews CompletedView',
    galleryState: 'service/completed',
  },

  /* ---- Info (611:398) — 6 ---- */
  {
    nodeId: '597:1131',
    name: 'long leave confirm',
    sectionNodeId: '611:398',
    convention: 'direct',
    statusBand: 32,
    bottomNav: true,
    width: 371,
    height: 946,
    implementation: 'src/app/(tabs)/niyam.tsx — leave rules',
    galleryState: 'info/leave-rules',
  },
  {
    nodeId: '597:1221',
    name: 'rating tiers',
    sectionNodeId: '611:398',
    convention: 'direct',
    statusBand: 36.198,
    bottomNav: false,
    width: 371,
    height: 882.1983,
    implementation: 'src/app/(tabs)/niyam.tsx — rating tiers',
    galleryState: 'info/rating-tiers',
  },
  {
    nodeId: '603:1865',
    name: 'No Show',
    sectionNodeId: '611:398',
    convention: 'direct',
    statusBand: 36.198,
    bottomNav: false,
    width: 371,
    height: 882.1983,
    implementation: 'src/app/(tabs)/niyam.tsx — no-show penalty',
    galleryState: 'info/no-show',
  },
  {
    nodeId: '603:1924',
    name: '>7 bonus',
    sectionNodeId: '611:398',
    convention: 'direct',
    statusBand: 36.198,
    bottomNav: false,
    width: 371,
    height: 882.1983,
    implementation: 'src/app/(tabs)/niyam.tsx — over-7-hour bonus',
    galleryState: 'info/bonus-over-7',
  },
  {
    nodeId: '605:2027',
    name: '5+ bonus',
    sectionNodeId: '611:398',
    convention: 'direct',
    statusBand: 36.198,
    bottomNav: false,
    width: 371,
    height: 882.1983,
    implementation: 'src/app/(tabs)/niyam.tsx — 5+ rating bonus',
    galleryState: 'info/bonus-5-plus',
  },
  {
    nodeId: '605:2094',
    name: 'Late',
    sectionNodeId: '611:398',
    convention: 'direct',
    statusBand: 36.198,
    bottomNav: false,
    width: 371,
    height: 882.1983,
    implementation: 'src/app/(tabs)/niyam.tsx — late penalty',
    galleryState: 'info/late',
  },
];

/**
 * The twelve V13 `Service flow` frames, kept so their disappearance is a recorded decision
 * rather than an oversight.
 *
 * Every one of these node ids is **absent** from the V14 file — verified by searching the
 * committed canvas dump for each id and finding zero occurrences. The V13 implementation built
 * against them (390x830 bezel frames, `36.198` status band) does not describe any V14 screen,
 * which is why the whole section is rebuilt rather than adjusted.
 */
export const removedV13ServiceFrames: readonly FigmaSection[] = [
  { nodeId: '462:3617', name: 'Page 4a- travel on time' },
  { nodeId: '463:3779', name: 'Page 4b- travel 5 mins buffer' },
  { nodeId: '464:3864', name: 'Page 4b- travel 5 mins buffer' },
  { nodeId: '468:3935', name: 'Page 5a- arrival on time' },
  { nodeId: '468:4040', name: 'Page 5b- arrival late' },
  { nodeId: '482:4587', name: 'Page 6a- Start OTP on time' },
  { nodeId: '482:4656', name: 'Page 6b- Start OTP on time' },
  { nodeId: '483:4741', name: 'Page 7a- Cooking' },
  { nodeId: '483:4795', name: 'Page 7b- Cooking (last 7 mins)' },
  { nodeId: '483:4835', name: 'Page 7c- Cooking extended' },
  { nodeId: '484:4875', name: 'Page 9- end OTP' },
  { nodeId: '485:4917', name: 'Page 10- job end' },
];

/**
 * Sections that exist on the V14 Cook canvas but are NOT approved.
 *
 * Empty in V14: `job flow` was the only V13 exclusion and it is now finalized. Kept as an
 * explicit empty list so that "nothing is excluded" is an assertion rather than an omission.
 */
export const excludedSections: readonly FigmaSection[] = [];

/**
 * Frame names that appear more than once across the finalized sections.
 *
 * `long leave confirm` appears three times and all three are distinct states: `592:832` carries
 * a single-day block with no applied leave, `592:1008` a taller block with one day already
 * applied, and `597:1131` is the `Info` section's rules rendering of the same card — it is the
 * one `Info` frame built on the 32-unit `phone bar` rather than the hairline mock. The three
 * `timer` frames differ by remaining-time format rather than by name.
 */
export const duplicateFrameNames: readonly string[] = ['long leave confirm'];

/**
 * The five bottom-nav destinations, in the order V14 draws them.
 *
 * `Niyam` is new in V14 and is what makes the `Info` section reachable.
 */
export const bottomNavTabs = ['Hazri', 'Kaam', 'Chutti', 'Kamai', 'Niyam'] as const;

/**
 * Screens whose view has not yet been rebuilt against V14.
 *
 * **Empty.** All 47 finalized screens now have a V14 view and a `/dev` state.
 *
 * The list is kept rather than deleted because `gallery.test.tsx` pins both directions against it:
 * a screen NOT on the ledger must have a gallery state, and a screen ON it must not. With the list
 * empty, the first half of that assertion is simply "every screen is built" — and adding a new
 * finalized frame to the inventory without building it fails the suite rather than passing quietly.
 */
export const pendingScreens: readonly string[] = [];

/** Screens whose V14 view is built and reachable in the development gallery. */
export function builtScreens(): readonly FigmaScreen[] {
  const pending = new Set(pendingScreens);
  return figmaScreens.filter((screen) => !pending.has(screen.nodeId));
}

export function implementationFor(nodeId: string): string | null {
  return figmaScreens.find((screen) => screen.nodeId === nodeId)?.implementation ?? null;
}

export function screensForSection(sectionNodeId: string): readonly FigmaScreen[] {
  return figmaScreens.filter((screen) => screen.sectionNodeId === sectionNodeId);
}

export function screenFor(nodeId: string): FigmaScreen | null {
  return figmaScreens.find((screen) => screen.nodeId === nodeId) ?? null;
}
