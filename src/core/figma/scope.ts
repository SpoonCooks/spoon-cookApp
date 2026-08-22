/**
 * The approved Figma scope, transcribed from the node tree.
 *
 * ## Provenance
 *
 * Read on 2026-08-21 from the **Figma desktop Dev Mode MCP server** (`127.0.0.1:3845`), which
 * serves the file open in the desktop app and therefore bypasses the remote server's Edit-seat
 * requirement. Source: file `FLrHofaiOZtMn3F84yHEZa`, canvas `434:2401` ("Cook App").
 *
 * Scope rule: a frame is in scope **only if it is a structural descendant of one of the four
 * `SECTION` nodes below**. Visual proximity is not scope — five frames sit at canvas top level and
 * are deliberately excluded from `figmaScreens` (see `outOfSectionFrames`).
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
}

/** The four approved sections, in canvas order. */
export const figmaSections: readonly FigmaSection[] = [
  { nodeId: '434:3115', name: 'Login flow' },
  { nodeId: '485:4971', name: 'Service flow' },
  { nodeId: '540:397', name: 'Performance & earnings' },
  { nodeId: '540:416', name: 'Attendance' },
];

/**
 * Every frame inside an approved section. 32 total: 5 + 12 + 7 + 8.
 *
 * Several frames are STATES of one screen rather than separate routes — twelve service frames are
 * twelve renderings of one booking, which is what lets the app reconcile after a restart instead
 * of landing on a stale screen.
 */
export const figmaScreens: readonly FigmaScreen[] = [
  /* ---- Login flow (434:3115) — 5 ---- */
  {
    nodeId: '434:3330',
    name: 'Page 0- loading page',
    sectionNodeId: '434:3115',
    implementation: 'src/app/index.tsx',
  },
  {
    nodeId: '434:3280',
    name: 'Page 1- Login No.',
    sectionNodeId: '434:3115',
    implementation: 'src/app/login.tsx',
  },
  {
    nodeId: '434:3224',
    name: 'Page 2a- Login OTP',
    sectionNodeId: '434:3115',
    implementation: 'src/app/otp.tsx — countdown state',
  },
  {
    nodeId: '434:3174',
    name: 'Page 2b- OTP resend',
    sectionNodeId: '434:3115',
    implementation: 'src/app/otp.tsx — resend-available state',
  },
  {
    nodeId: '434:3116',
    name: 'Page 2c- OTP wrong',
    sectionNodeId: '434:3115',
    implementation: 'src/app/otp.tsx — error state',
  },

  /* ---- Service flow (485:4971) — 12 ---- */
  {
    nodeId: '462:3617',
    name: 'Page 4a- travel on time',
    sectionNodeId: '485:4971',
    implementation: 'TravelView timing=on_time',
  },
  {
    nodeId: '463:3779',
    name: 'Page 4b- travel 5 mins buffer',
    sectionNodeId: '485:4971',
    implementation: 'TravelView timing=at_risk',
  },
  {
    nodeId: '464:3864',
    name: 'Page 4b- travel 5 mins buffer',
    sectionNodeId: '485:4971',
    implementation: 'TravelView timing=late',
  },
  {
    nodeId: '468:3935',
    name: 'Page 5a- arrival on time',
    sectionNodeId: '485:4971',
    implementation: 'ArrivalView timing=on_time',
  },
  {
    nodeId: '468:4040',
    name: 'Page 5b- arrival late',
    sectionNodeId: '485:4971',
    implementation: 'ArrivalView timing=late',
  },
  {
    nodeId: '482:4587',
    name: 'Page 6a- Start OTP on time',
    sectionNodeId: '485:4971',
    implementation: 'StartOtpView timing=on_time',
  },
  {
    nodeId: '482:4656',
    name: 'Page 6b- Start OTP on time',
    sectionNodeId: '485:4971',
    // Named "on time" but its copy is the LATE variant: `Customer ko LATE ke liye SORRY bole`.
    implementation: 'StartOtpView timing=late',
  },
  {
    nodeId: '483:4741',
    name: 'Page 7a- Cooking',
    sectionNodeId: '485:4971',
    implementation: 'CookingView normal',
  },
  {
    nodeId: '483:4795',
    name: 'Page 7b- Cooking (last 7 mins)',
    sectionNodeId: '485:4971',
    implementation: 'CookingView endingSoon',
  },
  {
    nodeId: '483:4835',
    name: 'Page 7c- Cooking extended',
    sectionNodeId: '485:4971',
    implementation: 'CookingView extended',
  },
  {
    nodeId: '484:4875',
    name: 'Page 9- end OTP',
    sectionNodeId: '485:4971',
    implementation: 'EndOtpView',
  },
  {
    nodeId: '485:4917',
    name: 'Page 10- job end',
    sectionNodeId: '485:4971',
    implementation: 'CompletedView',
  },

  /* ---- Performance & earnings (540:397) — 7 ---- */
  {
    nodeId: '485:5062',
    name: 'Page 3- money daily',
    sectionNodeId: '540:397',
    implementation: 'src/app/(tabs)/money.tsx — period=day',
  },
  {
    nodeId: '492:5336',
    name: 'Page 4 - money 7 days',
    sectionNodeId: '540:397',
    implementation: 'src/app/(tabs)/money.tsx — period=cycle',
  },
  {
    nodeId: '537:484',
    name: 'Page 6- day history',
    sectionNodeId: '540:397',
    implementation: 'src/app/money/cycles.tsx — day history list',
  },
  {
    nodeId: '537:700',
    name: 'Page 5- past daily',
    sectionNodeId: '540:397',
    implementation: 'src/app/money/cycle/[cycleId].tsx — past day detail',
  },
  {
    nodeId: '502:192',
    name: 'Page 7- money monthly',
    sectionNodeId: '540:397',
    implementation: 'src/app/(tabs)/money.tsx — period=month',
  },
  {
    nodeId: '502:442',
    name: 'Page 8- cycle history',
    sectionNodeId: '540:397',
    implementation: 'src/app/money/cycles.tsx',
  },
  {
    nodeId: '504:934',
    name: 'Page 9- past cycle',
    sectionNodeId: '540:397',
    implementation: 'src/app/money/cycle/[cycleId].tsx',
  },

  /* ---- Attendance (540:416) — 8 ---- */
  {
    nodeId: '506:1986',
    name: 'Page 11- attendance',
    sectionNodeId: '540:416',
    implementation: 'src/app/(tabs)/attendance.tsx — status=null (Mark Present)',
  },
  {
    nodeId: '526:292',
    name: 'Page 12a- present',
    sectionNodeId: '540:416',
    implementation: 'src/app/(tabs)/attendance.tsx — status=present',
  },
  {
    nodeId: '525:132',
    name: 'Page 12b- absent',
    sectionNodeId: '540:416',
    implementation: 'src/app/(tabs)/attendance.tsx — status=absent',
  },
  {
    nodeId: '528:659',
    name: 'Page 13a- long',
    sectionNodeId: '540:416',
    implementation: 'src/app/leave/range.tsx — empty selection',
  },
  {
    nodeId: '530:1349',
    name: 'Page 13b- long select',
    sectionNodeId: '540:416',
    implementation: 'src/app/leave/range.tsx — range selected',
  },
  {
    nodeId: '530:1478',
    name: 'Page 13c- long confirm',
    sectionNodeId: '540:416',
    implementation: 'src/app/(tabs)/attendance.tsx — upcoming-leave state (GAP-21 blocked)',
  },
  {
    nodeId: '528:483',
    name: 'Page 14a- 1day',
    sectionNodeId: '540:416',
    implementation: 'src/app/leave/single.tsx — confirm',
  },
  {
    nodeId: '529:1259',
    name: 'Page 14b- 1day confirm',
    sectionNodeId: '540:416',
    implementation: 'src/app/leave/single.tsx — applied state (GAP-21 blocked)',
  },
];

/**
 * Frames at canvas top level, OUTSIDE every section.
 *
 * Recorded so their exclusion is a decision rather than an oversight. `434:3086` and `494:5648` are
 * the Jobs destination and are still implemented — the in-section Service flow is unreachable
 * without them — which is an explicit, documented deviation from strict section scope. The other
 * three are components, not screens.
 */
export const outOfSectionFrames: readonly FigmaScreen[] = [
  {
    nodeId: '434:3086',
    name: 'Page 3- job list',
    sectionNodeId: '(none)',
    implementation: 'src/app/(tabs)/jobs.tsx — retained: entry point to the Service section',
  },
  {
    nodeId: '494:5648',
    name: 'Page 3a- start',
    sectionNodeId: '(none)',
    implementation: 'src/app/(tabs)/jobs.tsx — same screen, actionable card',
  },
  {
    nodeId: '494:5627',
    name: 'jobs',
    sectionNodeId: '(none)',
    implementation: 'JobCard component sample — no route',
  },
  {
    nodeId: '434:2741',
    name: 'div.rounded-3xl',
    sectionNodeId: '(none)',
    implementation: 'JobCard component sample — no route',
  },
  {
    nodeId: '434:2743',
    name: 'div.bg-red-600',
    sectionNodeId: '(none)',
    implementation: 'RUNNING LATE badge component sample — no route',
  },
];

export function implementationFor(nodeId: string): string | null {
  return figmaScreens.find((screen) => screen.nodeId === nodeId)?.implementation ?? null;
}
