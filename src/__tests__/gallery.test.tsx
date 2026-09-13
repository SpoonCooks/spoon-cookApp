import { render, screen } from '@testing-library/react-native';
import { Image, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { builtScreens, figmaScreens, pendingScreens } from '@core/figma/scope';
import { bottomNavTabFor, galleryEntries, galleryEntryFor } from '@features/dev/galleryStates';
import { BottomNav } from '@ui';

/**
 * Development gallery contract.
 *
 * The gallery is how every V14 state gets in front of a camera without an approved test Cook, so
 * its ids must stay pinned to the Figma inventory. A renamed state that still renders would
 * silently orphan a Figma frame from its evidence folder, and the pixel run would keep passing
 * while comparing the wrong screen.
 */

describe('gallery entries', () => {
  it('uses ids that exist in the V14 scope', () => {
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
      ['592:1070', 'job flow'],
      ['611:398', 'Info'],
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
    expect(galleryEntryFor('jobs/next-5')?.nodeId).toBe('583:479');
    expect(galleryEntryFor('jobs/nope')).toBeNull();
  });

  it('covers all thirteen Service flow frames', () => {
    // V14 deleted every V13 service node, so none of the twelve old entries survives here — these
    // are thirteen new ones built against the rebuilt section.
    const service = galleryEntries.filter((entry) => entry.section === 'Service flow');
    expect(service).toHaveLength(13);
    for (const entry of service) expect(entry.nodeId).toMatch(/^(614|622|628):/);
  });

  it('covers all six Info frames', () => {
    expect(galleryEntries.filter((entry) => entry.section === 'Info')).toHaveLength(6);
  });

  it('covers all five Login flow frames', () => {
    const login = galleryEntries.filter((entry) => entry.section === 'Login flow');
    expect(login).toHaveLength(5);
  });

  it('covers all five job flow frames', () => {
    const jobs = galleryEntries.filter((entry) => entry.section === 'job flow');
    expect(jobs).toHaveLength(5);
  });

  it('covers all four log in flow frames', () => {
    const attendance = galleryEntries.filter((entry) => entry.section === 'log in flow');
    expect(attendance).toHaveLength(4);
  });

  it('covers all seven leave frames', () => {
    const leave = galleryEntries.filter((entry) => entry.section === 'leave');
    expect(leave).toHaveLength(7);
  });

  it('covers all seven performance frames', () => {
    const performance = galleryEntries.filter((entry) => entry.section === 'performance');
    expect(performance).toHaveLength(7);
  });

  /**
   * Coverage is asserted as an exact set in BOTH directions, against the `pendingScreens` ledger
   * in `@core/figma/scope`.
   *
   * V14 raised the inventory from 35 screens to 47 and rebuilt `Service flow` on a new authoring
   * convention, so nineteen screens are outstanding. Rather than relax this assertion — which is
   * the one thing stopping the gallery implying coverage it does not have — the outstanding node
   * ids are enumerated in `pendingScreens`, and this test pins both sides against it:
   *
   *   - a screen NOT on the ledger must have a `/dev` state (nothing may quietly go missing), and
   *   - a screen ON the ledger must NOT have one (the ledger cannot go stale while work lands).
   *
   * So removing an id from the ledger without building its state fails here, and building a state
   * without removing its id fails here too. The gap is visible in code and enforced, and the suite
   * still fails the moment either side drifts.
   */
  it('builds a /dev state for every screen not on the pending ledger', () => {
    const built = new Set(galleryEntries.map((entry) => entry.id));
    const missing = builtScreens()
      .filter((screen) => !built.has(screen.galleryState))
      .map((screen) => screen.galleryState)
      .sort();

    expect(missing).toEqual([]);
  });

  it('builds no /dev state for a screen still on the pending ledger', () => {
    const built = new Set(galleryEntries.map((entry) => entry.id));
    const pending = new Set(pendingScreens);
    const claimed = figmaScreens
      .filter((screen) => pending.has(screen.nodeId) && built.has(screen.galleryState))
      .map((screen) => screen.nodeId)
      .sort();

    expect(claimed).toEqual([]);
  });

  it('accounts for all 47 finalized screens, built plus pending', () => {
    expect(figmaScreens).toHaveLength(47);
    expect(builtScreens()).toHaveLength(47);
    expect(pendingScreens).toHaveLength(0);
    expect(galleryEntries).toHaveLength(47);

    // Every pending id is a real screen, so the ledger cannot name a frame that does not exist.
    const inventory = new Set(figmaScreens.map((screen) => screen.nodeId));
    for (const nodeId of pendingScreens) expect(inventory.has(nodeId)).toBe(true);
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

  it('renders the job flow lead card with the fixture countdown', () => {
    render(withSafeArea(galleryEntryFor('jobs/next-45')!.render()));
    expect(screen.getByText('25 mins')).toBeTruthy();
  });

  it('escalates the lead card CTA copy with the countdown', () => {
    // `583:427` -> `583:453` -> `583:479` change the CTA label as well as the colourway, and the
    // label is what a screenshot can actually distinguish the three frames by.
    render(withSafeArea(galleryEntryFor('jobs/next-5')!.render()));
    expect(screen.getByText('CHALO!!')).toBeTruthy();
  });
});

/**
 * Bottom-nav coverage in the gallery.
 *
 * V14 draws the five-tab bar on 33 of the 47 frames, and no feature view renders one — in the
 * running app it is the navigator's chrome. The gallery renders views directly, so its HOST must
 * supply the bar. When it did not, all 33 nav-bearing screens captured without it and each scored
 * a 68-unit band of pure difference along the bottom edge, which reads in a report as an
 * implementation defect rather than the harness gap it was.
 */
describe('gallery bottom nav', () => {
  const byNode = new Map(figmaScreens.map((screen) => [screen.nodeId, screen]));

  it('claims a bar for exactly the frames scope marks bottomNav', () => {
    for (const entry of galleryEntries) {
      expect({ id: entry.id, hasBar: bottomNavTabFor(entry) !== null }).toEqual({
        id: entry.id,
        hasBar: byNode.get(entry.nodeId)?.bottomNav === true,
      });
    }
  });

  it('covers all 33 nav-bearing frames and no others', () => {
    const withBar = galleryEntries.filter((entry) => bottomNavTabFor(entry) !== null);
    expect(withBar).toHaveLength(33);
    expect(galleryEntries).toHaveLength(47);
  });

  it('highlights the destination measured from each section reference render', () => {
    const expected: Record<string, string> = {
      'log in flow': 'hazri',
      'job flow': 'kaam',
      'Service flow': 'kaam',
      leave: 'chutti',
      performance: 'kamai',
      Info: 'niyam',
    };
    for (const entry of galleryEntries) {
      const tab = bottomNavTabFor(entry);
      if (tab === null) continue;
      expect({ id: entry.id, tab }).toEqual({ id: entry.id, tab: expected[entry.section] });
    }
  });

  it('never draws a bar on a Login flow frame', () => {
    // Pre-auth: none of the five frames has one, and drawing it would put a signed-in navigator
    // on a screen reached before sign-in.
    for (const entry of galleryEntries.filter((e) => e.section === 'Login flow')) {
      expect(bottomNavTabFor(entry)).toBeNull();
    }
  });

  /**
   * The glyphs must carry a definite pixel size.
   *
   * `alignSelf: 'stretch'` plus `StyleSheet.absoluteFill` — the literal reading of the design's
   * `absolute inset-0 size-full` — collapsed the icon box to zero width on device and rendered all
   * five glyphs BLANK, while the labels and the `#ffef99` pill drew perfectly. The bar looked
   * finished in review and only a pixel diff caught it. A percentage or absolute fill creeping
   * back would reintroduce exactly that, and nothing else here would notice.
   */
  it('gives every nav glyph a numeric width and height', () => {
    const view = render(<BottomNav active="chutti" />);
    const images = view.UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(5);
    for (const image of images) {
      const style = StyleSheet.flatten(image.props.style) as {
        width?: unknown;
        height?: unknown;
      };
      expect(typeof style.width).toBe('number');
      expect(typeof style.height).toBe('number');
      expect(style.width as number).toBeGreaterThan(0);
      expect(style.height as number).toBeGreaterThan(0);
    }
  });
});
