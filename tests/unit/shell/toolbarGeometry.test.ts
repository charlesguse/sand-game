import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { GEOMETRY_INVARIANTS } from './geometryInvariants';
import {
  formatFailure,
  checkControlBoxSizing,
  checkControlGuardedDeclarations,
  checkSelectedGuardedDeclarations,
  checkRailFlowDirection,
  checkBandWrapping,
  checkBandBoxSizing,
  checkBandSafeAreaPadding,
  checkGapAxes,
  checkArrangementSingleSource,
  type GeometryCheckResult,
} from './geometryGate';

/**
 * computeToolbarLayout budgets the band from --control-size and lays controls out along a known
 * axis. This suite runs every 'pinned' GEOMETRY_INVARIANTS entry for the toolbar band/control
 * through its named geometryGate.ts check (FR-014) — US1's Independent Test: a rendered control
 * or band can never silently exceed what the layout model budgeted.
 */
const toolbar = readFileSync(fileURLToPath(new URL('../../../src/lib/Toolbar.svelte', import.meta.url)), 'utf8');
const app = readFileSync(fileURLToPath(new URL('../../../src/App.svelte', import.meta.url)), 'utf8');

const TOOLBAR_CHECKS: Record<string, () => GeometryCheckResult | GeometryCheckResult[]> = {
  checkControlBoxSizing: () => checkControlBoxSizing(toolbar),
  checkControlGuardedDeclarations: () => checkControlGuardedDeclarations(toolbar),
  checkSelectedGuardedDeclarations: () => checkSelectedGuardedDeclarations(toolbar),
  checkRailFlowDirection: () => checkRailFlowDirection(toolbar),
  checkBandWrapping: () => checkBandWrapping(toolbar),
  checkBandBoxSizing: () => checkBandBoxSizing(toolbar),
  checkBandSafeAreaPadding: () => checkBandSafeAreaPadding(toolbar),
  checkGapAxes: () => checkGapAxes(toolbar),
  checkArrangementSingleSource: () => checkArrangementSingleSource(app, toolbar),
};

const PINNED_TOOLBAR_ENTRIES = GEOMETRY_INVARIANTS.filter(
  (invariant) =>
    invariant.mechanism === 'pinned' && (invariant.component === 'toolbar-control' || invariant.component === 'toolbar-band'),
);

describe('the rendered toolbar matches the layout model (FR-010, FR-014)', () => {
  it('every pinned toolbar-band/toolbar-control invariant names a real geometryGate.ts check', () => {
    for (const invariant of PINNED_TOOLBAR_ENTRIES) {
      expect(invariant.checkId, `invariant "${invariant.id}" is pinned but has no checkId`).toBeDefined();
      expect(
        TOOLBAR_CHECKS[invariant.checkId as string],
        `invariant "${invariant.id}" names unknown check "${invariant.checkId}"`,
      ).toBeDefined();
    }
  });

  const checkedIds = [...new Set(PINNED_TOOLBAR_ENTRIES.map((invariant) => invariant.checkId as string))];
  for (const checkId of checkedIds) {
    it(`${checkId} passes against the live component source`, () => {
      const outcome = TOOLBAR_CHECKS[checkId]();
      const results = Array.isArray(outcome) ? outcome : [outcome];
      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.ok, formatFailure(result)).toBe(true);
      }
    });
  }
});
