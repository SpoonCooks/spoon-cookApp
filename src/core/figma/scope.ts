/**
 * The approved Figma scope, transcribed from the **V13** node tree.
 *
 * ## Provenance
 *
 * Read on 2026-08-23 from the **Figma desktop Dev Mode MCP server** (`127.0.0.1:3845`), which
 * serves the file open in the desktop app and therefore bypasses the remote server's Edit-seat
 * requirement. The remote server (`mcp.figma.com`) answers `get_metadata` on this file with
 * "Looks like you don't have edit access" — the local server is the only working path.
 *
 * Source: file `COBtuKtaNXzjPGhRgqWZ7t` ("V0_-user-app--13-"), page `Cook App` = `434:2401`.
 * The file has two pages; `0:1` ("User App") is the customer app and is entirely out of scope.
 *
 * Scope rule: a screen counts **only if it is a direct child frame of one of the five finalized
 * `SECTION` nodes below**. Nested component frames and loose canvas frames are not screens.
 *
 * ## V12 to V13
 *
 * The section list changed shape, not just contents:
 *
 *   - `Attendance` (`540:416`) was **renamed to `leave`** and its contents replaced wholesale.
 *     All eight V12 frames (`Page 11- attendance` through `Page 14b- 1day confirm`) are gone;
 *     seven new `592:*` frames stand in their place. This is the largest single V13 change.
 *   - `log in flow` (`592:1068`) is a **new section** built from four frames that existed in V12
 *     only as loose canvas frames. V12 recorded them as "not implemented"; V13 promotes them to
 *     finalized screens, so they are now required work.
 *   - `job flow` (`592:1070`) is likewise a new section built from V12 loose frames, but it is
 *     **explicitly excluded** from V13 scope by the implementation brief.
 *   - `Login flow`, `Service flow` and `performance` keep their ids and every one of their 24
 *     frames is a structurally identical subtree across the V12 and V13 reads (compared by
 *     tag/name/width/height at every depth).
 *
 * This file is data, not behaviour, so that `figmaScope.test.ts` can assert the implementation
 * covers the design rather than the other way round.
 */

export interface FigmaSection {
  readonly nodeId: string;
  readonly name: string;
}

export interface FigmaScreen {
  readonly nodeId: string;
  readonly name: string;
  readonly sectionNodeId: string;
  /** Where this frame is implemented, or the state that renders it. */
  readonly implementation: string;
  /** The gallery state id that opens this exact frame in the development gallery. */
  readonly galleryState: string;
}

/** The five finalized V13 sections. Names are literal: `Login flow` is not `log in flow`. */
export const figmaSections: readonly FigmaSection[] = [
  { nodeId: '434:3115', name: 'Login flow' },
  { nodeId: '540:416', name: 'leave' },
  { nodeId: '592:1068', name: 'log in flow' },
  { nodeId: '575:1741', name: 'performance' },
  { nodeId: '485:4971', name: 'Service flow' },
];

/**
 * Sections that exist on the V13 canvas but are NOT approved.
 *
 * `job flow` is visible in the file and looks finished, but the brief excludes it. The existing
 * Jobs screens stay in the app because Service flow is unreachable without them; they are simply
 * not rebuilt and not counted.
 */
export const excludedSections: readonly FigmaSection[] = [{ nodeId: '592:1070', name: 'job flow' }];

/**
 * The V12 `Attendance` frames, kept so their disappearance is a recorded decision rather than an
 * oversight. Every one of these node ids is absent from the V13 file.
 */
export const removedV12Frames: readonly FigmaScreen[] = [
  {
    nodeId: '506:1986',
    name: 'Page 11- attendance',
    sectionNodeId: '540:416',
    implementation: 'removed in V13',
    galleryState: '(none)',
  },
  {
    nodeId: '526:292',
    name: 'Page 12a- present',
    sectionNodeId: '540:416',
    implementation: 'removed in V13',
    galleryState: '(none)',
  },
  {
    nodeId: '525:132',
    name: 'Page 12b- absent',
    sectionNodeId: '540:416',
    implementation: 'removed in V13',
    galleryState: '(none)',
  },
  {
    nodeId: '528:659',
    name: 'Page 13a- long',
    sectionNodeId: '540:416',
    implementation: 'removed in V13',
    galleryState: '(none)',
  },
  {
    nodeId: '530:1349',
    name: 'Page 13b- long select',
    sectionNodeId: '540:416',
    implementation: 'removed in V13',
    galleryState: '(none)',
  },
  {
    nodeId: '530:1478',
    name: 'Page 13c- long confirm',
    sectionNodeId: '540:416',
    implementation: 'removed in V13',
    galleryState: '(none)',
  },
  {
    nodeId: '528:483',
    name: 'Page 14a- 1day',
    sectionNodeId: '540:416',
    implementation: 'removed in V13',
    galleryState: '(none)',
  },
  {
    nodeId: '529:1259',
    name: 'Page 14b- 1day confirm',
    sectionNodeId: '540:416',
    implementation: 'removed in V13',
    galleryState: '(none)',
  },
];

/**
 * Every direct-child frame of a finalized section. **35 total: 5 + 7 + 4 + 7 + 12.**
 *
 * The count comes from V13 itself, not from V12's 32. Several frames are STATES of one route
 * rather than separate routes — the twelve service frames are twelve renderings of one booking,
 * which is what lets the app reconcile after a restart instead of landing on a stale screen.
 */
export const figmaScreens: readonly FigmaScreen[] = [
  /* ---- Login flow (434:3115) — 5. Unchanged from V12. ---- */
  {
    nodeId: '434:3330',
    name: 'Page 0- loading page',
    sectionNodeId: '434:3115',
    implementation: 'src/app/index.tsx',
    galleryState: 'login/boot',
  },
  {
    nodeId: '434:3280',
    name: 'Page 1- Login No.',
    sectionNodeId: '434:3115',
    implementation: 'src/app/login.tsx',
    galleryState: 'login/phone',
  },
  {
    nodeId: '434:3224',
    name: 'Page 2a- Login OTP',
    sectionNodeId: '434:3115',
    implementation: 'src/app/otp.tsx — countdown state',
    galleryState: 'login/otp-countdown',
  },
  {
    nodeId: '434:3174',
    name: 'Page 2b- OTP resend',
    sectionNodeId: '434:3115',
    implementation: 'src/app/otp.tsx — resend-available state',
    galleryState: 'login/otp-resend',
  },
  {
    nodeId: '434:3116',
    name: 'Page 2c- OTP wrong',
    sectionNodeId: '434:3115',
    implementation: 'src/app/otp.tsx — error state',
    galleryState: 'login/otp-wrong',
  },

  /* ---- leave (540:416) — 7. Entirely NEW in V13. ---- */
  {
    nodeId: '592:488',
    name: 'Leave present',
    sectionNodeId: '540:416',
    // Today is NOT offerable: the cook is working, so the first offerable day is Kal.
    implementation: 'src/app/(tabs)/chutti.tsx — cook present today (AAJ KA BREAK card shown)',
    galleryState: 'leave/present',
  },
  {
    nodeId: '592:489',
    name: 'Leave absent',
    sectionNodeId: '540:416',
    // No break card, and today IS offerable.
    implementation: 'src/app/(tabs)/chutti.tsx — cook not working today',
    galleryState: 'leave/absent',
  },
  {
    nodeId: '592:563',
    name: 'long leave',
    sectionNodeId: '540:416',
    implementation: 'src/app/leave/range.tsx — no dates selected',
    galleryState: 'leave/long-empty',
  },
  {
    nodeId: '592:639',
    name: 'long leave selected',
    sectionNodeId: '540:416',
    implementation: 'src/app/leave/range.tsx — 16-25 Nov selected, Total din 10',
    galleryState: 'leave/long-selected',
  },
  {
    nodeId: '592:832',
    name: 'long leave confirm',
    sectionNodeId: '540:416',
    // Distinct from 592:1008: a 228-tall single-day block and a date title, no applied day.
    implementation: 'src/app/(tabs)/chutti.tsx — long leave booked, no single-day leave applied',
    galleryState: 'leave/long-booked',
  },
  {
    nodeId: '592:1008',
    name: 'long leave confirm',
    sectionNodeId: '540:416',
    // Same name as 592:832 but a genuinely different state: 343-tall block with an applied day.
    implementation: 'src/app/(tabs)/chutti.tsx — single-day leave applied AND long leave booked',
    galleryState: 'leave/applied-and-booked',
  },
  {
    nodeId: '592:888',
    name: 'short leave',
    sectionNodeId: '540:416',
    implementation: 'src/app/leave/single.tsx — confirm sheet',
    galleryState: 'leave/short-confirm',
  },

  /* ---- log in flow (592:1068) — 4. New section; frames existed loose in V12. ---- */
  {
    nodeId: '575:2135',
    name: '3a- daily log in',
    sectionNodeId: '592:1068',
    implementation: 'src/app/(tabs)/attendance.tsx — eligible, not yet marked',
    galleryState: 'login-flow/daily',
  },
  {
    nodeId: '575:2137',
    name: '3b- present',
    sectionNodeId: '592:1068',
    implementation: 'src/app/(tabs)/attendance.tsx — marked present',
    galleryState: 'login-flow/present',
  },
  {
    nodeId: '575:2138',
    name: '3c- absent',
    sectionNodeId: '592:1068',
    implementation: 'src/app/(tabs)/attendance.tsx — absent',
    galleryState: 'login-flow/absent',
  },
  {
    nodeId: '575:2136',
    name: '3d- log out',
    sectionNodeId: '592:1068',
    implementation: 'src/app/(tabs)/attendance.tsx — shift finished',
    galleryState: 'login-flow/logout',
  },

  /* ---- performance (575:1741) — 7. Unchanged from V12. ---- */
  {
    nodeId: '575:1744',
    name: '12- money daily',
    sectionNodeId: '575:1741',
    implementation: 'src/app/(tabs)/money.tsx — period=day',
    galleryState: 'performance/money-daily',
  },
  {
    nodeId: '575:1884',
    name: '13- money weekly',
    sectionNodeId: '575:1741',
    implementation: 'src/app/(tabs)/money.tsx — period=cycle (sevenDay)',
    galleryState: 'performance/money-weekly',
  },
  {
    nodeId: '575:1903',
    name: '14- day history',
    sectionNodeId: '575:1741',
    implementation: 'src/app/money/days.tsx',
    galleryState: 'performance/day-history',
  },
  {
    nodeId: '575:1922',
    name: '15- past daily',
    sectionNodeId: '575:1741',
    implementation: 'src/app/money/day/[date].tsx',
    galleryState: 'performance/past-daily',
  },
  {
    nodeId: '575:2013',
    name: '16- money monthly',
    sectionNodeId: '575:1741',
    implementation: 'src/app/(tabs)/money.tsx — period=month',
    galleryState: 'performance/money-monthly',
  },
  {
    nodeId: '575:2032',
    name: '17- weekly history',
    sectionNodeId: '575:1741',
    implementation: 'src/app/money/cycles.tsx',
    galleryState: 'performance/weekly-history',
  },
  {
    nodeId: '575:2098',
    name: '18- past weekly',
    sectionNodeId: '575:1741',
    implementation: 'src/app/money/cycle/[cycleId].tsx',
    galleryState: 'performance/past-weekly',
  },

  /* ---- Service flow (485:4971) — 12. Unchanged from V12. ---- */
  {
    nodeId: '462:3617',
    name: 'Page 4a- travel on time',
    sectionNodeId: '485:4971',
    implementation: 'TravelView timing=on_time',
    galleryState: 'service/travel-on-time',
  },
  {
    nodeId: '463:3779',
    name: 'Page 4b- travel 5 mins buffer',
    sectionNodeId: '485:4971',
    implementation: 'TravelView timing=at_risk',
    galleryState: 'service/travel-at-risk',
  },
  {
    nodeId: '464:3864',
    name: 'Page 4b- travel 5 mins buffer',
    sectionNodeId: '485:4971',
    implementation: 'TravelView timing=late',
    galleryState: 'service/travel-late',
  },
  {
    nodeId: '468:3935',
    name: 'Page 5a- arrival on time',
    sectionNodeId: '485:4971',
    implementation: 'ArrivalView timing=on_time',
    galleryState: 'service/arrival-on-time',
  },
  {
    nodeId: '468:4040',
    name: 'Page 5b- arrival late',
    sectionNodeId: '485:4971',
    implementation: 'ArrivalView timing=late',
    galleryState: 'service/arrival-late',
  },
  {
    nodeId: '482:4587',
    name: 'Page 6a- Start OTP on time',
    sectionNodeId: '485:4971',
    implementation: 'StartOtpView timing=on_time',
    galleryState: 'service/start-otp-on-time',
  },
  {
    nodeId: '482:4656',
    name: 'Page 6b- Start OTP on time',
    sectionNodeId: '485:4971',
    // Named "on time" but its copy is the LATE variant: `Customer ko LATE ke liye SORRY bole`.
    implementation: 'StartOtpView timing=late',
    galleryState: 'service/start-otp-late',
  },
  {
    nodeId: '483:4741',
    name: 'Page 7a- Cooking',
    sectionNodeId: '485:4971',
    implementation: 'CookingView normal',
    galleryState: 'service/cooking',
  },
  {
    nodeId: '483:4795',
    name: 'Page 7b- Cooking (last 7 mins)',
    sectionNodeId: '485:4971',
    implementation: 'CookingView endingSoon',
    galleryState: 'service/cooking-ending',
  },
  {
    nodeId: '483:4835',
    name: 'Page 7c- Cooking extended',
    sectionNodeId: '485:4971',
    implementation: 'CookingView extended',
    galleryState: 'service/cooking-extended',
  },
  {
    nodeId: '484:4875',
    name: 'Page 9- end OTP',
    sectionNodeId: '485:4971',
    implementation: 'EndOtpView',
    galleryState: 'service/end-otp',
  },
  {
    nodeId: '485:4917',
    name: 'Page 10- job end',
    sectionNodeId: '485:4971',
    implementation: 'CompletedView',
    galleryState: 'service/completed',
  },
];

/**
 * Direct children of the EXCLUDED `job flow` section.
 *
 * Recorded so the exclusion is auditable and so a test can assert none of them leaked into
 * {@link figmaScreens}. The existing `src/app/(tabs)/jobs.tsx` still renders the job list — it is
 * the only route from which Service flow can be reached — but it is deliberately NOT rebuilt
 * against these frames and does not count toward the V13 total.
 */
export const excludedJobFlowFrames: readonly FigmaScreen[] = [
  {
    nodeId: '583:375',
    name: '4a- jobs log out',
    sectionNodeId: '592:1070',
    implementation: 'not rebuilt — job flow is unapproved',
    galleryState: '(none)',
  },
  {
    nodeId: '583:401',
    name: '4b- job log in',
    sectionNodeId: '592:1070',
    implementation: 'not rebuilt — job flow is unapproved',
    galleryState: '(none)',
  },
  {
    nodeId: '583:427',
    name: '4c- next in <45 mins',
    sectionNodeId: '592:1070',
    implementation: 'not rebuilt — job flow is unapproved',
    galleryState: '(none)',
  },
  {
    nodeId: '583:453',
    name: '4d- next <10 mins',
    sectionNodeId: '592:1070',
    implementation: 'not rebuilt — job flow is unapproved',
    galleryState: '(none)',
  },
  {
    nodeId: '583:479',
    name: '4e- next <5 mins',
    sectionNodeId: '592:1070',
    implementation: 'not rebuilt — job flow is unapproved',
    galleryState: '(none)',
  },
];

/**
 * Frame names that appear twice inside one finalized section.
 *
 * Both `long leave confirm` frames are real, distinct states — `592:832` carries a 228-tall
 * single-day block with no applied leave, `592:1008` a 343-tall block with one day already
 * applied — so they are counted separately rather than consolidated. The two
 * `Page 4b- travel 5 mins buffer` frames are likewise the at-risk and late renderings.
 */
export const duplicateFrameNames: readonly string[] = [
  'long leave confirm',
  'Page 4b- travel 5 mins buffer',
];

export function implementationFor(nodeId: string): string | null {
  return figmaScreens.find((screen) => screen.nodeId === nodeId)?.implementation ?? null;
}

export function screensForSection(sectionNodeId: string): readonly FigmaScreen[] {
  return figmaScreens.filter((screen) => screen.sectionNodeId === sectionNodeId);
}
