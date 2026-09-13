import {
  bottomNavTabs,
  duplicateFrameNames,
  excludedSections,
  figmaScreens,
  figmaSections,
  implementationFor,
  removedV13ServiceFrames,
  screenFor,
  screensForSection,
} from '@core/figma/scope';

/**
 * Scope guard.
 *
 * The approved V14 scope is "every frame that is a DIRECT CHILD of one of the seven `SECTION`
 * nodes on page `434:2401`". That tree was enumerated from the remote Figma MCP server on
 * 2026-08-25 (file `3iYf9ckrUDZLPlJP56dyKI`, page `Cook App`), committed verbatim as
 * `docs/.figma-canvas-v14-434-2401.xml`, and reduced to `@core/figma/scope` by
 * `scripts/visual/inventory.py`.
 *
 * These tests exist so a screen cannot quietly go missing, so a frame that is NOT in a finalized
 * section cannot quietly acquire a route, and so the V13 count and the deleted V13 Service nodes
 * cannot creep back in.
 */

const SECTION_IDS = {
  login: '434:3115',
  logInFlow: '592:1068',
  leave: '540:416',
  performance: '575:1741',
  jobFlow: '592:1070',
  service: '485:4971',
  info: '611:398',
} as const;

describe('finalized V14 sections', () => {
  it('has exactly the seven finalized sections', () => {
    expect(figmaSections.map((section) => section.nodeId).sort()).toEqual(
      Object.values(SECTION_IDS).slice().sort(),
    );
  });

  it('names them exactly as Figma does', () => {
    const byId = new Map(figmaSections.map((section) => [section.nodeId, section.name]));
    expect(byId.get(SECTION_IDS.login)).toBe('Login flow');
    expect(byId.get(SECTION_IDS.logInFlow)).toBe('log in flow');
    expect(byId.get(SECTION_IDS.leave)).toBe('leave');
    expect(byId.get(SECTION_IDS.performance)).toBe('performance');
    expect(byId.get(SECTION_IDS.service)).toBe('Service flow');
    // Both promoted in V14; `job flow` was excluded by brief in V13 and `Info` did not exist.
    expect(byId.get(SECTION_IDS.jobFlow)).toBe('job flow');
    expect(byId.get(SECTION_IDS.info)).toBe('Info');
  });

  it('treats `Login flow` and `log in flow` as two separate sections', () => {
    // The names differ only by a space and a capital. Collapsing them would silently drop four
    // screens, so the distinction is asserted rather than assumed.
    const names = figmaSections.map((section) => section.name);
    expect(names).toContain('Login flow');
    expect(names).toContain('log in flow');
    expect(new Set(names).size).toBe(figmaSections.length);
  });

  it('excludes nothing — `job flow` was the only V13 exclusion and V14 finalizes it', () => {
    expect(excludedSections).toEqual([]);
  });
});

describe('V14 screen inventory', () => {
  it('counts 47 screens, not V13’s 35', () => {
    expect(figmaScreens).toHaveLength(47);
  });

  it('distributes them 5 / 4 / 7 / 7 / 5 / 13 / 6 across the finalized sections', () => {
    expect(screensForSection(SECTION_IDS.login)).toHaveLength(5);
    expect(screensForSection(SECTION_IDS.logInFlow)).toHaveLength(4);
    expect(screensForSection(SECTION_IDS.leave)).toHaveLength(7);
    expect(screensForSection(SECTION_IDS.performance)).toHaveLength(7);
    expect(screensForSection(SECTION_IDS.jobFlow)).toHaveLength(5);
    expect(screensForSection(SECTION_IDS.service)).toHaveLength(13);
    expect(screensForSection(SECTION_IDS.info)).toHaveLength(6);
  });

  it('places every screen inside a finalized section', () => {
    const sectionIds = new Set(figmaSections.map((section) => section.nodeId));
    for (const screen of figmaScreens) {
      expect(sectionIds.has(screen.sectionNodeId)).toBe(true);
    }
  });

  it('uses a unique node id for every screen', () => {
    const ids = figmaScreens.map((screen) => screen.nodeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every screen an implementation and a gallery state', () => {
    for (const screen of figmaScreens) {
      expect(screen.implementation.length).toBeGreaterThan(0);
      expect(screen.implementation).not.toBe('(none)');
      expect(screen.galleryState).toMatch(/^[a-z-]+\/[a-z0-9-]+$/);
    }
  });

  it('gives every screen a unique gallery state', () => {
    const states = figmaScreens.map((screen) => screen.galleryState);
    expect(new Set(states).size).toBe(states.length);
  });

  it('resolves an implementation by node id', () => {
    expect(implementationFor('592:488')).toContain('(tabs)/chutti.tsx');
    expect(implementationFor('nope')).toBeNull();
  });
});

describe('per-frame comparison geometry', () => {
  it('records a positive width and height for every screen', () => {
    for (const screen of figmaScreens) {
      expect(screen.width).toBeGreaterThan(0);
      expect(screen.height).toBeGreaterThan(0);
    }
  });

  it('uses the bezel convention only for `Login flow`', () => {
    // V13's `Service flow` was also bezel. V14 rebuilt it as 371-wide direct frames, and applying
    // the old profile would displace all thirteen Service comparisons.
    const bezel = figmaScreens.filter((screen) => screen.convention === 'bezel');
    expect(bezel).toHaveLength(5);
    expect(new Set(bezel.map((screen) => screen.sectionNodeId))).toEqual(
      new Set([SECTION_IDS.login]),
    );
  });

  it('gives bezel frames the 390x830 frame size and a 33-unit status band', () => {
    for (const screen of figmaScreens.filter((s) => s.convention === 'bezel')) {
      expect(screen.width).toBe(390);
      expect(screen.height).toBe(830);
      expect(screen.statusBand).toBe(33);
    }
  });

  it('draws every direct frame against the same 370dp content column', () => {
    // Three literal widths appear — 370, 370.44 and 371 — but they are one column with different
    // rounding, which is what lets a single `screenWidth / 370` scale factor stay correct.
    for (const screen of figmaScreens.filter((s) => s.convention === 'direct')) {
      expect(screen.width).toBeGreaterThanOrEqual(370);
      expect(screen.width).toBeLessThanOrEqual(371);
    }
  });

  it('uses only the three status-bar mocks V14 actually draws', () => {
    const bands = new Set(figmaScreens.map((screen) => screen.statusBand));
    expect([...bands].sort((a, b) => a - b)).toEqual([32, 33, 36.198]);
  });

  it('mixes two status mocks inside the `Info` section', () => {
    // This is why the band is per screen and not per section: a section-level table would
    // mis-align `597:1131` by four design rows.
    const info = screensForSection(SECTION_IDS.info);
    expect(screenFor('597:1131')?.statusBand).toBe(32);
    for (const screen of info.filter((s) => s.nodeId !== '597:1131')) {
      expect(screen.statusBand).toBe(36.198);
    }
  });
});

describe('the V14 bottom nav', () => {
  it('names the five tabs in the order Figma draws them', () => {
    expect(bottomNavTabs).toEqual(['Hazri', 'Kaam', 'Chutti', 'Kamai', 'Niyam']);
  });

  it('carries the nav on 33 of the 47 frames', () => {
    expect(figmaScreens.filter((screen) => screen.bottomNav)).toHaveLength(33);
  });

  it('never draws the nav on a pre-auth `Login flow` frame', () => {
    for (const screen of screensForSection(SECTION_IDS.login)) {
      expect(screen.bottomNav).toBe(false);
    }
  });

  it('draws it on every `Service flow`, `performance`, `job flow` and `log in flow` frame', () => {
    const always = [
      SECTION_IDS.service,
      SECTION_IDS.performance,
      SECTION_IDS.jobFlow,
      SECTION_IDS.logInFlow,
    ];
    for (const sectionId of always) {
      for (const screen of screensForSection(sectionId)) {
        expect(screen.bottomNav).toBe(true);
      }
    }
  });
});

describe('duplicate frame names', () => {
  it('keeps all three `long leave confirm` frames as separate screens', () => {
    const confirms = figmaScreens.filter((screen) => screen.name === 'long leave confirm');
    expect(confirms.map((screen) => screen.nodeId).sort()).toEqual([
      '592:1008',
      '592:832',
      '597:1131',
    ]);
    expect(new Set(confirms.map((screen) => screen.galleryState)).size).toBe(3);
  });

  it('records every name that appears more than once', () => {
    const counts = new Map<string, number>();
    for (const screen of figmaScreens) {
      counts.set(screen.name, (counts.get(screen.name) ?? 0) + 1);
    }
    const repeated = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
      .sort();
    expect(repeated).toEqual(duplicateFrameNames.slice().sort());
  });
});

describe('the Service flow rebuild', () => {
  it('drops every V13 Service frame from the inventory', () => {
    // All twelve are absent from the V14 canvas. None may survive just because a route once
    // rendered it — the V13 views were built against a different frame size entirely.
    const inventory = new Set(figmaScreens.map((screen) => screen.nodeId));
    for (const gone of removedV13ServiceFrames) {
      expect(inventory.has(gone.nodeId)).toBe(false);
    }
  });

  it('records all twelve of them', () => {
    expect(removedV13ServiceFrames).toHaveLength(12);
  });

  it('rebuilt the section from new node ids only', () => {
    // Every V14 service frame is a 614/622/628 node. A 46x/48x id would mean a V13 frame leaked.
    for (const screen of screensForSection(SECTION_IDS.service)) {
      expect(screen.nodeId).toMatch(/^(614|622|628):/);
    }
  });

  it('carries four distinct timer renderings, including the extension', () => {
    const timers = screensForSection(SECTION_IDS.service).filter((screen) =>
      screen.name.includes('timer'),
    );
    expect(timers).toHaveLength(4);
    expect(screenFor('622:1163')?.galleryState).toBe('service/timer-extension');
    // The extension frame is 64 units taller than the timer screens it reverts to.
    expect(screenFor('622:1163')?.height).toBe(927);
    expect(screenFor('622:1085')?.height).toBe(863);
  });
});

describe('sections V14 promoted', () => {
  it('implements all five `job flow` frames instead of excluding them', () => {
    const jobs = screensForSection(SECTION_IDS.jobFlow);
    expect(jobs.map((screen) => screen.nodeId).sort()).toEqual([
      '583:375',
      '583:401',
      '583:427',
      '583:453',
      '583:479',
    ]);
    for (const screen of jobs) {
      expect(screen.implementation).not.toContain('unapproved');
      expect(screen.implementation).toContain('jobs.tsx');
    }
  });

  it('routes every `Info` frame through the new Niyam tab', () => {
    for (const screen of screensForSection(SECTION_IDS.info)) {
      expect(screen.implementation).toContain('niyam.tsx');
    }
  });
});
