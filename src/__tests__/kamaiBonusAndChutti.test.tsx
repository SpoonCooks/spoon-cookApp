import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { isChuttiPeriod } from '@core/domain/money';
import { performanceFixtures } from '@core/fixtures';
import { MoneyPeriodView, PastDayView } from '@features/performance/PerformanceViews';
import { HoursBonusBar } from '@ui/components/Performance';

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

/** The fill of each track segment, in order. */
function segmentFills(): string[] {
  const track = screen.getByTestId('bonus-bar-track');
  return (track.props.children as React.ReactElement[]).map(
    (segment) =>
      (
        StyleSheet.flatten((segment.props as { style: unknown }).style as never) as {
          backgroundColor: string;
        }
      ).backgroundColor,
  );
}

describe('the hours bonus bar (`1:12668` locked, `392:8943` unlocked)', () => {
  it('is locked with one segment per threshold hour, filling one per hour worked', () => {
    render(<HoursBonusBar workedMinutes={3 * 60 + 40} thresholdMinutes={420} />);

    expect(screen.getByTestId('bonus-bar-locked')).toBeTruthy();
    expect(screen.getByText('BONUS: 7 se zyada ghante kaam')).toBeTruthy();
    expect(segmentFills()).toEqual([
      '#ffd600',
      '#ffd600',
      '#ffd600',
      '#fff7cc',
      '#fff7cc',
      '#fff7cc',
      '#fff7cc',
    ]);
  });

  it('unlocks at the threshold onto five empty blocks', () => {
    render(<HoursBonusBar workedMinutes={420} thresholdMinutes={420} />);

    expect(screen.getByTestId('bonus-bar-unlocked')).toBeTruthy();
    expect(screen.getByText('AAPKE BONUS UNLOCK HO GAYA HAI')).toBeTruthy();
    expect(segmentFills()).toEqual(Array(5).fill('#fff7cc'));
  });

  it('fills one unlocked block for each full hour past the threshold', () => {
    // 9h45: two full hours past seven.
    render(<HoursBonusBar workedMinutes={585} thresholdMinutes={420} />);
    expect(segmentFills()).toEqual(['#cfff04', '#cfff04', '#fff7cc', '#fff7cc', '#fff7cc']);
  });

  it('stays full past the last block', () => {
    render(<HoursBonusBar workedMinutes={14 * 60} thresholdMinutes={420} />);
    expect(segmentFills()).toEqual(Array(5).fill('#cfff04'));
  });

  it('takes its segment count from the policy, not a literal 7', () => {
    render(<HoursBonusBar workedMinutes={0} thresholdMinutes={300} />);
    expect(segmentFills()).toHaveLength(5);
    expect(screen.getByText('BONUS: 5 se zyada ghante kaam')).toBeTruthy();
  });
});

describe('whether she was on chutti for a period', () => {
  const WINDOW = { from: '2026-09-24', to: '2026-09-30' };

  it('is chutti when the period holds an absent or leave day and no present one', () => {
    expect(
      isChuttiPeriod([{ serviceDate: '2026-09-29', status: 'leave' }], WINDOW, '2026-09-30'),
    ).toBe(true);
    expect(
      isChuttiPeriod(
        [
          { serviceDate: '2026-09-28', status: 'absent' },
          { serviceDate: '2026-09-29', status: 'present' },
        ],
        WINDOW,
        '2026-09-30',
      ),
    ).toBe(false);
  });

  it('is not chutti with nothing recorded, or only outside the window', () => {
    expect(isChuttiPeriod([], WINDOW, '2026-09-30')).toBe(false);
    expect(
      isChuttiPeriod([{ serviceDate: '2026-09-20', status: 'absent' }], WINDOW, '2026-09-30'),
    ).toBe(false);
  });

  it('ignores days after today in a cycle that runs past it', () => {
    expect(
      isChuttiPeriod(
        [
          { serviceDate: '2026-09-26', status: 'absent' },
          // A future day can only be leave she has booked; it does not decide today's screen.
          { serviceDate: '2026-10-01', status: 'present' },
        ],
        { from: '2026-09-25', to: '2026-10-01' },
        '2026-09-27',
      ),
    ).toBe(true);
  });
});

describe('the chutti Kamai screens (`385:8782`, `392:8957`, `392:9025`)', () => {
  it.each([
    ['day', 'Aaj aap chutti pe hai'],
    ['cycle', 'Ye cycle aap chutti pe hai'],
    ['month', 'Ye mahine aap chutti pe hai'],
  ] as const)('replaces the %s panels with the chutti notice', (period, message) => {
    render(
      withSafeArea(
        <MoneyPeriodView
          period={period}
          view={performanceFixtures.cycle()}
          bonus={performanceFixtures.bonus()}
          rating={performanceFixtures.rating()}
          days={[]}
          tabs={[{ key: period, title: 'T', subtitle: 'S' }]}
          onChangePeriod={() => undefined}
          chutti
        />,
      ),
    );

    expect(screen.getByTestId(`money-chutti-${period}`)).toBeTruthy();
    // The section label upper-cases its line, as the design draws it.
    expect(screen.getByText(message.toUpperCase())).toBeTruthy();
    expect(screen.getByText('KAMAI DEKHNE KE LIYE KAAM PE AAYE')).toBeTruthy();
    expect(screen.queryByTestId('mistakes-card-late-count')).toBeNull();
  });
});

describe('Din ki kamai — a past day', () => {
  const pastDay = (hoursBonus: Parameters<typeof PastDayView>[0]['hoursBonus']) =>
    render(
      withSafeArea(
        <PastDayView
          label="30th Sep"
          view={performanceFixtures.daily()}
          hoursBonus={hoursBonus}
          rating={performanceFixtures.rating()}
          onBack={() => undefined}
        />,
      ),
    );

  it('draws that day’s hours rule, not the cycle’s attendance meter', () => {
    pastDay({ ...performanceFixtures.hoursBonus(), workedMinutes: 90 });
    expect(screen.getByTestId('bonus-bar-locked')).toBeTruthy();
    expect(screen.getByText('BONUS: 7 se zyada ghante kaam')).toBeTruthy();
    expect(screen.queryByText(/din kaam/)).toBeNull();
  });

  it('draws no bar at all when the day’s hours are unknown', () => {
    pastDay(null);
    expect(screen.queryByTestId('bonus-bar')).toBeNull();
    expect(screen.queryByText(/din kaam/)).toBeNull();
  });
});
