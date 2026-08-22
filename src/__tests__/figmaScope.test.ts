import { figmaSections, figmaScreens, implementationFor } from '@core/figma/scope';

/**
 * Scope guard.
 *
 * The approved scope is "every frame that is a DESCENDANT of one of the four `SECTION` nodes on
 * canvas `434:2401`". That tree was enumerated directly from the Figma desktop Dev Mode MCP server
 * on 2026-08-21 and is transcribed into `@core/figma/scope`.
 *
 * These tests exist so a screen cannot quietly go missing, and so a frame that is NOT in an
 * approved section cannot quietly acquire a route.
 */

describe('approved Figma sections', () => {
  it('has exactly the four sections found on the canvas', () => {
    expect(figmaSections.map((section) => section.nodeId).sort()).toEqual(
      ['434:3115', '485:4971', '540:397', '540:416'].sort(),
    );
  });

  it('names them as Figma does', () => {
    const byId = new Map(figmaSections.map((section) => [section.nodeId, section.name]));
    expect(byId.get('434:3115')).toBe('Login flow');
    expect(byId.get('485:4971')).toBe('Service flow');
    // Note the real name is "Performance & earnings", not "Performance & My Money".
    expect(byId.get('540:397')).toBe('Performance & earnings');
    expect(byId.get('540:416')).toBe('Attendance');
  });
});

describe('approved screen inventory', () => {
  it('counts 32 in-section screens', () => {
    expect(figmaScreens).toHaveLength(32);
  });

  it('matches the per-section counts read from the node tree', () => {
    const countFor = (sectionId: string): number =>
      figmaScreens.filter((screen) => screen.sectionNodeId === sectionId).length;

    expect(countFor('434:3115')).toBe(5);
    expect(countFor('485:4971')).toBe(12);
    expect(countFor('540:397')).toBe(7);
    expect(countFor('540:416')).toBe(8);
  });

  it('gives every approved screen an implementation mapping', () => {
    for (const screen of figmaScreens) {
      expect(implementationFor(screen.nodeId)).not.toBeNull();
    }
  });

  it('has no duplicate node ids', () => {
    const ids = figmaScreens.map((screen) => screen.nodeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('assigns every screen to one of the approved sections', () => {
    const sectionIds = new Set(figmaSections.map((section) => section.nodeId));
    for (const screen of figmaScreens) {
      expect(sectionIds.has(screen.sectionNodeId)).toBe(true);
    }
  });
});

describe('the complete Attendance section', () => {
  const attendance = figmaScreens.filter((screen) => screen.sectionNodeId === '540:416');

  it('includes all eight frames, not just a generic attendance screen', () => {
    expect(attendance.map((screen) => screen.nodeId).sort()).toEqual(
      [
        '506:1986', // Page 11- attendance
        '526:292', // Page 12a- present
        '525:132', // Page 12b- absent
        '528:659', // Page 13a- long
        '530:1349', // Page 13b- long select
        '530:1478', // Page 13c- long confirm
        '528:483', // Page 14a- 1day
        '529:1259', // Page 14b- 1day confirm
      ].sort(),
    );
  });

  it('maps every attendance frame to a real implementation', () => {
    for (const screen of attendance) {
      expect(implementationFor(screen.nodeId)).not.toBeNull();
    }
  });
});

describe('both Page 4b travel variants survive', () => {
  it('keeps the at-risk and late frames as separate screens', () => {
    // They share a Figma NAME. Collapsing them would erase the risk/late distinction, which is
    // exactly what the negative countdown depends on.
    const fourB = figmaScreens.filter((screen) => screen.name === 'Page 4b- travel 5 mins buffer');
    expect(fourB).toHaveLength(2);
    expect(fourB.map((screen) => screen.nodeId).sort()).toEqual(['463:3779', '464:3864']);
  });
});

describe('out-of-section frames', () => {
  it('excludes the loose component samples from the screen inventory', () => {
    // `jobs` (494:5627), `div.rounded-3xl` (434:2741) and `div.bg-red-600` (434:2743) sit at canvas
    // top level and are components, not screens. They must never acquire a route.
    const ids = new Set(figmaScreens.map((screen) => screen.nodeId));
    expect(ids.has('494:5627')).toBe(false);
    expect(ids.has('434:2741')).toBe(false);
    expect(ids.has('434:2743')).toBe(false);
  });

  it('excludes the removed Attendance & Leaves frame', () => {
    // `505:1596` existed in the previous import and has been deleted from this file. It must not
    // linger in the inventory just because it was once implemented.
    const ids = new Set(figmaScreens.map((screen) => screen.nodeId));
    expect(ids.has('505:1596')).toBe(false);
  });
});
