import {
  duplicateFrameNames,
  excludedJobFlowFrames,
  excludedSections,
  figmaScreens,
  figmaSections,
  implementationFor,
  removedV12Frames,
  screensForSection,
} from '@core/figma/scope';

/**
 * Scope guard.
 *
 * The approved V13 scope is "every frame that is a DIRECT CHILD of one of the five finalized
 * `SECTION` nodes on page `434:2401`". That tree was enumerated from the Figma desktop Dev Mode
 * MCP server on 2026-08-23 (file `COBtuKtaNXzjPGhRgqWZ7t`, page `Cook App`) and is transcribed
 * into `@core/figma/scope`.
 *
 * These tests exist so a screen cannot quietly go missing, so a frame that is NOT in a finalized
 * section cannot quietly acquire a route, and so the excluded `job flow` cannot creep back in.
 */

const SECTION_IDS = {
  login: '434:3115',
  leave: '540:416',
  logInFlow: '592:1068',
  performance: '575:1741',
  service: '485:4971',
} as const;

describe('finalized V13 sections', () => {
  it('has exactly the five finalized sections', () => {
    expect(figmaSections.map((section) => section.nodeId).sort()).toEqual(
      Object.values(SECTION_IDS).slice().sort(),
    );
  });

  it('names them exactly as Figma does', () => {
    const byId = new Map(figmaSections.map((section) => [section.nodeId, section.name]));
    expect(byId.get(SECTION_IDS.login)).toBe('Login flow');
    expect(byId.get(SECTION_IDS.service)).toBe('Service flow');
    // Renamed from "Attendance" in V12 and refilled with seven new frames.
    expect(byId.get(SECTION_IDS.leave)).toBe('leave');
    expect(byId.get(SECTION_IDS.performance)).toBe('performance');
    expect(byId.get(SECTION_IDS.logInFlow)).toBe('log in flow');
  });

  it('treats `Login flow` and `log in flow` as two separate sections', () => {
    // The names differ only by a space and a capital. Collapsing them would silently drop four
    // screens, so the distinction is asserted rather than assumed.
    const names = figmaSections.map((section) => section.name);
    expect(names).toContain('Login flow');
    expect(names).toContain('log in flow');
    expect(new Set(names).size).toBe(figmaSections.length);
  });
});

describe('V13 screen inventory', () => {
  it('counts 35 screens, not V12’s 32', () => {
    expect(figmaScreens).toHaveLength(35);
  });

  it('distributes them 5 / 7 / 4 / 7 / 12 across the finalized sections', () => {
    expect(screensForSection(SECTION_IDS.login)).toHaveLength(5);
    expect(screensForSection(SECTION_IDS.leave)).toHaveLength(7);
    expect(screensForSection(SECTION_IDS.logInFlow)).toHaveLength(4);
    expect(screensForSection(SECTION_IDS.performance)).toHaveLength(7);
    expect(screensForSection(SECTION_IDS.service)).toHaveLength(12);
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
    // `leave` is reached through the Chutti tab, not a standalone `leave/` route: V13 promotes it
    // to a primary destination, which is why `592:488` resolves into `(tabs)`.
    expect(implementationFor('592:488')).toContain('(tabs)/chutti.tsx');
    expect(implementationFor('nope')).toBeNull();
  });
});

describe('duplicate frame names', () => {
  it('keeps both `long leave confirm` frames as separate screens', () => {
    // 592:832 carries a 228-tall single-day block; 592:1008 a 343-tall block with an applied day.
    // They share a name in Figma but are different states, so neither may be consolidated away.
    const confirms = figmaScreens.filter((screen) => screen.name === 'long leave confirm');
    expect(confirms.map((screen) => screen.nodeId).sort()).toEqual(['592:1008', '592:832']);
    expect(confirms[0]?.galleryState).not.toBe(confirms[1]?.galleryState);
  });

  it('keeps both `Page 4b- travel 5 mins buffer` frames as separate screens', () => {
    const travel = figmaScreens.filter((screen) => screen.name === 'Page 4b- travel 5 mins buffer');
    expect(travel.map((screen) => screen.nodeId).sort()).toEqual(['463:3779', '464:3864']);
    expect(travel[0]?.implementation).not.toBe(travel[1]?.implementation);
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

describe('excluded job flow', () => {
  it('does not list `job flow` as a finalized section', () => {
    const ids = new Set(figmaSections.map((section) => section.nodeId));
    expect(ids.has('592:1070')).toBe(false);
    expect(excludedSections.map((section) => section.name)).toEqual(['job flow']);
  });

  it('leaves no screen pointing at the job flow section', () => {
    expect(figmaScreens.filter((screen) => screen.sectionNodeId === '592:1070')).toEqual([]);
  });

  it('keeps every job flow frame out of the inventory', () => {
    const inventory = new Set(figmaScreens.map((screen) => screen.nodeId));
    for (const frame of excludedJobFlowFrames) {
      expect(inventory.has(frame.nodeId)).toBe(false);
    }
  });

  it('records all five job flow frames so the exclusion is auditable', () => {
    expect(excludedJobFlowFrames).toHaveLength(5);
    for (const frame of excludedJobFlowFrames) {
      expect(frame.implementation).toContain('unapproved');
    }
  });
});

describe('V12 frames that V13 deleted', () => {
  it('drops every V12 `Attendance` frame from the inventory', () => {
    // V13 renamed the section to `leave` and replaced its contents. None of the old frames may
    // survive in the inventory just because a route once rendered it.
    const inventory = new Set(figmaScreens.map((screen) => screen.nodeId));
    for (const gone of removedV12Frames) {
      expect(inventory.has(gone.nodeId)).toBe(false);
    }
  });

  it('records all eight of them', () => {
    expect(removedV12Frames).toHaveLength(8);
    expect(removedV12Frames.every((frame) => frame.sectionNodeId === '540:416')).toBe(true);
  });

  it('rebuilt the leave section from new node ids only', () => {
    // Every V13 leave frame is a 592:* node. A 5xx id here would mean a V12 frame leaked through.
    for (const screen of screensForSection(SECTION_IDS.leave)) {
      expect(screen.nodeId.startsWith('592:')).toBe(true);
    }
  });
});

describe('log in flow promotion', () => {
  it('implements the four frames V12 left as loose canvas frames', () => {
    const ids = screensForSection(SECTION_IDS.logInFlow)
      .map((screen) => screen.nodeId)
      .sort();
    expect(ids).toEqual(['575:2135', '575:2136', '575:2137', '575:2138']);
  });

  it('no longer marks any of them as not implemented', () => {
    for (const screen of screensForSection(SECTION_IDS.logInFlow)) {
      expect(screen.implementation).not.toContain('not implemented');
      expect(screen.implementation).toContain('attendance.tsx');
    }
  });
});
