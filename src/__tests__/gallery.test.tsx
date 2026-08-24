import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { figmaScreens } from '@core/figma/scope';
import { galleryEntries, galleryEntryFor } from '@features/dev/galleryStates';

/**
 * Development gallery contract.
 *
 * The gallery is how every V13 state gets in front of a camera without an approved test Cook, so
 * its ids must stay pinned to the Figma inventory. A renamed state that still renders would
 * silently orphan a Figma frame from its evidence folder, and the pixel run would keep passing
 * while comparing the wrong screen.
 */

describe('gallery entries', () => {
  it('uses ids that exist in the V13 scope', () => {
    const known = new Set(figmaScreens.map((screen) => screen.galleryState));
    for (const entry of galleryEntries) {
      expect(known.has(entry.id)).toBe(true);
    }
  });

  it('points each entry at the Figma node that scope assigns to its id', () => {
    const byState = new Map(figmaScreens.map((screen) => [screen.galleryState, screen]));
    for (const entry of galleryEntries) {
      expect(entry.nodeId).toBe(byState.get(entry.id)?.nodeId);
    }
  });

  it('declares the section the scope assigns to that node', () => {
    const sectionByNode = new Map([
      ['485:4971', 'Service flow'],
      ['434:3115', 'Login flow'],
      ['540:416', 'leave'],
      ['592:1068', 'log in flow'],
      ['575:1741', 'performance'],
    ]);
    const byNode = new Map(figmaScreens.map((screen) => [screen.nodeId, screen]));
    for (const entry of galleryEntries) {
      const screen = byNode.get(entry.nodeId);
      expect(entry.section).toBe(sectionByNode.get(screen?.sectionNodeId ?? ''));
    }
  });

  it('uses a unique id per entry', () => {
    const ids = galleryEntries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves a known id and rejects an unknown one', () => {
    expect(galleryEntryFor('service/cooking')?.nodeId).toBe('483:4741');
    expect(galleryEntryFor('service/nope')).toBeNull();
  });

  it('covers all twelve Service flow frames', () => {
    const service = galleryEntries.filter((entry) => entry.section === 'Service flow');
    expect(service).toHaveLength(12);
  });

  it('covers all five Login flow frames', () => {
    const login = galleryEntries.filter((entry) => entry.section === 'Login flow');
    expect(login).toHaveLength(5);
  });

  it('covers all four log in flow frames', () => {
    const attendance = galleryEntries.filter((entry) => entry.section === 'log in flow');
    expect(attendance).toHaveLength(4);
  });

  it('covers all seven leave frames', () => {
    const leave = galleryEntries.filter((entry) => entry.section === 'leave');
    expect(leave).toHaveLength(7);
  });

  /**
   * Coverage is asserted as an exact list rather than a count, so that adding the performance
   * screens forces this test to be updated deliberately. Until those seven screens exist, the
   * gallery must not pretend to cover them.
   */
  it('reports honest coverage of the 35 finalized screens', () => {
    const built = new Set(galleryEntries.map((entry) => entry.id));
    const missing = figmaScreens
      .filter((screen) => !built.has(screen.galleryState))
      .map((screen) => screen.galleryState)
      .sort();

    expect(built.size).toBe(28);
    expect(missing).toEqual(
      [
        'performance/day-history',
        'performance/money-daily',
        'performance/money-monthly',
        'performance/money-weekly',
        'performance/past-daily',
        'performance/past-weekly',
        'performance/weekly-history',
      ].sort(),
    );
  });
});

describe('gallery rendering', () => {
  // The Login views read the real safe-area inset — the design's status band is system chrome they
  // must sit below — so they need a provider. `initialMetrics` keeps the inset deterministic
  // instead of letting the harness invent one.
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

  it('renders every entry without throwing', () => {
    for (const entry of galleryEntries) {
      const view = render(withSafeArea(entry.render()));
      expect(view.toJSON()).not.toBeNull();
      view.unmount();
    }
  });

  it('renders the cooking state with the fixture countdown', () => {
    render(withSafeArea(galleryEntryFor('service/cooking')!.render()));
    expect(screen.getByText('37 mins')).toBeTruthy();
  });

  it('renders the late travel state with a negative countdown', () => {
    // The negative value is the whole point of `464:3864`; clamping it to zero would erase the
    // state the frame exists to show.
    render(withSafeArea(galleryEntryFor('service/travel-late')!.render()));
    expect(screen.getByText('-2 mins')).toBeTruthy();
  });
});
