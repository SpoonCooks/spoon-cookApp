import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { jobsV14Fixtures, performanceFixtures } from '@core/fixtures';
import { buildRuleSheets } from '@features/info/rules';
import { JobsView } from '@features/jobs/JobViews';
import { MoneyPeriodView } from '@features/performance/PerformanceViews';

/**
 * Per-frame design facts that a shared component would otherwise flatten.
 *
 * The V14 pixel run kept finding the same shape of defect: one component correctly built, and
 * five frames rendered through it as if they were identical when the file says they are not. A
 * gallery state that draws the wrong minute, the wrong type size or the wrong padding still
 * renders, still passes every behavioural test, and only a diff against the reference catches it
 * — which costs an emulator run each time.
 *
 * So the differences are pinned here, next to the node id that states them. Each assertion is a
 * measurement someone took out of Figma; if a future refactor decides the five rule sheets can
 * share one blurb padding, this fails and says which frame disagrees.
 */

const withSafeArea = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 870 },
      insets: { top: 49, left: 0, right: 0, bottom: 24 },
    }}
  >
    {node}
  </SafeAreaProvider>
);

describe('job flow — each frame publishes its own list', () => {
  /**
   * `583:375`, `583:401` and `583:427` draw three DIFFERENT lists. A single shared fixture drew
   * the logged-out times on all five frames, so four of them were wrong on every row.
   */
  const times = (): string[] =>
    screen.getAllByTestId(/^job-tile-/).map((tile) => {
      const texts: string[] = [];
      const walk = (node: unknown): void => {
        if (typeof node === 'string') {
          texts.push(node);
          return;
        }
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (node !== null && typeof node === 'object' && 'props' in node) {
          walk((node as { props: { children?: unknown } }).props.children);
        }
      };
      walk(tile.props.children);
      return texts[0] ?? '';
    });

  it('draws `583:375` on the half hour', () => {
    render(withSafeArea(<JobsView dateLabel="7 November" {...jobsV14Fixtures.loggedOut()} />));
    expect(times()).toEqual(['8:30 AM', '8:30 AM', '8:30 AM', '5:30 PM', '3:30 PM', '5:30 PM']);
  });

  it('moves four of the six five minutes earlier on `583:401`', () => {
    render(withSafeArea(<JobsView dateLabel="7 November" {...jobsV14Fixtures.loggedIn()} />));
    expect(times()).toEqual(['8:25 AM', '8:30 AM', '8:30 AM', '5:25 PM', '3:25 PM', '5:25 PM']);
  });

  it('drops to five rows behind the lead card on `583:427`', () => {
    render(
      withSafeArea(<JobsView dateLabel="7 November" {...jobsV14Fixtures.countdown(25, 'soon')} />),
    );
    expect(times()).toEqual(['7:55 AM', '8:10 AM', '5:25 PM', '3:25 PM', '5:25 PM']);
  });

  it('draws the full `AAJ KA BREAK` headline, not the two words that fit', () => {
    render(withSafeArea(<JobsView dateLabel="7 November" {...jobsV14Fixtures.loggedIn()} />));
    // Android under-measures a tracked run and drops the last word at a word boundary when the
    // label is sized to its own content. `573:1208` is `w-full` for exactly this reason.
    expect(screen.getByText('AAJ KA BREAK')).toBeTruthy();
  });
});

/**
 * The sheets are built from an explicit policy, because they are no longer a constant.
 *
 * These are the values the deployed backend publishes today. Stating them here rather than
 * importing a fixture is deliberate: this suite asserts the frame's GEOMETRY, and the geometry
 * must not move when a policy is published. The money assertions below use the same policy so a
 * derivation error is still caught.
 */
const TEST_POLICY = {
  version: 'earnings-test',
  cycleLengthDays: 28,
  presentDayBasePaise: 100_000,
  fivePlusBonusPaise: 10_000,
  longHoursThresholdMinutes: 300,
  longHoursRatePerHourPaise: 15_000,
  fullCycleBonusPaise: 200_000,
  twentySevenDayBonusPaise: 100_000,
  paidLeaveRefundPaise: 100_000,
  noShowPenaltyPaise: 30_000,
  noShowPenaltyStepPaise: 10_000,
  lateGraceMinutes: 0,
  latePenaltyPerMinutePaise: 1_000,
  presentDayRatingTiers: [
    { minRating: 4.8, basePaise: 117_500 },
    { minRating: 4.5, basePaise: 107_500 },
    { minRating: 4.2, basePaise: 92_500 },
    { minRating: 4.0, basePaise: 72_500 },
  ],
};
const ruleSheets = buildRuleSheets(TEST_POLICY);

describe('Info rule sheets — five frames, five sets of overrides', () => {
  /** `597:1247` omits the vertical padding the four policy sheets set. */
  it('gives the rating sheet no blurb padding and the policy sheets six units', () => {
    expect(ruleSheets['rating-tiers'].blurbPaddingV).toBe(0);
    expect(ruleSheets['no-show'].blurbPaddingV).toBe(6);
    expect(ruleSheets['bonus-over-7'].blurbPaddingV).toBe(6);
    expect(ruleSheets['bonus-5-plus'].blurbPaddingV).toBe(6);
    expect(ruleSheets.late.blurbPaddingV).toBe(6);
  });

  /** `603:1902` is 20; `603:1967` and `609:331` drop to 18 to fit a third column. */
  it('sizes a policy cell by the frame, not by the component', () => {
    const size = (key: keyof typeof ruleSheets): number | undefined => {
      const body = ruleSheets[key].body;
      return body.kind === 'policy' ? body.cellFontSize : undefined;
    };
    expect(size('no-show')).toBe(20);
    expect(size('late')).toBe(20);
    expect(size('bonus-over-7')).toBe(18);
    expect(size('bonus-5-plus')).toBe(18);
  });

  /** `603:1918` and `605:2143` set 0.18; `603:1973` and `609:349` set none. */
  it('tracks the penalty footnotes and leaves the bonus footnotes alone', () => {
    const tracking = (key: keyof typeof ruleSheets): number | undefined => {
      const body = ruleSheets[key].body;
      return body.kind === 'policy' ? body.footnoteTracking : undefined;
    };
    expect(tracking('no-show')).toBe(0.18);
    expect(tracking('late')).toBe(0.18);
    expect(tracking('bonus-over-7')).toBe(0);
    expect(tracking('bonus-5-plus')).toBe(0);
  });

  /**
   * `603:1977` and `605:2147` let the value flex because `4 hrs 5 mins` and `1 hr 34 mins` do not
   * fit 58 units; the other three pin it. The value is CENTRED in whichever box it gets.
   */
  it('pins the standing boxes each frame states', () => {
    expect(ruleSheets['rating-tiers'].standingValueWidth).toBe(58);
    expect(ruleSheets['no-show'].standingValueWidth).toBe(58);
    expect(ruleSheets['bonus-5-plus'].standingValueWidth).toBe(58);
    expect(ruleSheets['bonus-over-7'].standingValueWidth).toBeNull();
    expect(ruleSheets.late.standingValueWidth).toBeNull();
    expect(ruleSheets.late.standingLabelWidth).toBe(165);
    expect(ruleSheets['no-show'].standingLabelWidth).toBe(183);
  });

  /** The design's emphasis carries the following word: `₹150 bonus`, not `₹150`. */
  it('keeps the bold spans where V14 ends them', () => {
    const strong = (key: keyof typeof ruleSheets): string[] => {
      const body = ruleSheets[key].body;
      return body.kind === 'policy'
        ? body.footnote.filter((segment) => segment.strong === true).map((s) => s.text)
        : [];
    };
    expect(strong('bonus-over-7')).toEqual(['1 extra ghante', '₹150 bonus']);
    expect(strong('bonus-5-plus')).toEqual(['5+', '₹100 bonus ']);
    expect(strong('late')).toEqual(['har minute,', '₹10']);
    // The published escalation: each further no-show in the cycle adds the published step.
    expect(strong('no-show')).toEqual(['1 NO SHOW', '₹100']);
  });
});

describe('performance — the Late tile draws minutes, and each frame states its own', () => {
  const lateValue = (view: ReturnType<typeof performanceFixtures.cycle>): string => {
    render(
      withSafeArea(
        <MoneyPeriodView
          period="cycle"
          view={view}
          bonus={performanceFixtures.bonus()}
          rating={performanceFixtures.rating()}
          days={[]}
          tabs={[]}
          onChangePeriod={() => undefined}
        />,
      ),
    );
    return screen.getByTestId('mistakes-card-late-count').props.children as string;
  };

  it('reads `20 min` on `575:1884` and `2 min` on `575:2098`', () => {
    expect(lateValue(performanceFixtures.cycle())).toBe('20 min');
    screen.unmount();
    expect(lateValue(performanceFixtures.cycle(2))).toBe('2 min');
  });

  it('reads `8 min` on `575:1744`', () => {
    expect(lateValue(performanceFixtures.daily(8))).toBe('8 min');
  });

  /**
   * The deployed contract has no late-duration field, so production leaves it `null` and the tile
   * falls back to the count it does have. The two numbers are NOT interchangeable: twice late for
   * a minute each is not two minutes late.
   */
  it('falls back to the event count when the server does not send minutes', () => {
    expect(lateValue({ ...performanceFixtures.cycle(), lateMinutes: null })).toBe('2');
  });

  /** `492:5414` reads `7 hr ke upar kaam`, not `7 din`. */
  it('captions the bonus tile in the design’s unit', () => {
    render(
      withSafeArea(
        <MoneyPeriodView
          period="cycle"
          view={performanceFixtures.cycle()}
          bonus={performanceFixtures.bonus()}
          rating={performanceFixtures.rating()}
          days={[]}
          tabs={[]}
          onChangePeriod={() => undefined}
        />,
      ),
    );
    expect(screen.getByText('7 hr ke upar kaam')).toBeTruthy();
  });
});
