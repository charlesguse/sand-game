import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { GEOMETRY_INVARIANTS } from './geometryInvariants';
import {
  formatFailure,
  checkControlBoxSizing,
  checkControlGuardedDeclarations,
  checkSelectedGuardedDeclarations,
  checkPressedGuardedDeclarations,
  checkRailFlowDirection,
  checkBandWrapping,
  checkBandBoxSizing,
  checkBandSafeAreaPadding,
  checkGapAxes,
  checkArrangementSingleSource,
  extractRuleBlock,
  HISTORICAL_CAUSE_MUTATORS,
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
  checkPressedGuardedDeclarations: () => checkPressedGuardedDeclarations(toolbar),
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

// Single-source-string checks a mutator can target (checkArrangementSingleSource needs two files
// and isn't targeted by any historical-cause mutator, so it's not in this map).
const SINGLE_SOURCE_CHECKS: Record<string, (source: string) => GeometryCheckResult | GeometryCheckResult[]> = {
  checkControlBoxSizing,
  checkControlGuardedDeclarations,
  checkSelectedGuardedDeclarations,
  checkPressedGuardedDeclarations,
  checkRailFlowDirection,
  checkBandWrapping,
  checkBandBoxSizing,
  checkBandSafeAreaPadding,
  checkGapAxes,
};

function allOk(outcome: GeometryCheckResult | GeometryCheckResult[]): boolean {
  const results = Array.isArray(outcome) ? outcome : [outcome];
  return results.length > 0 && results.every((result) => result.ok);
}

describe('the three historical causes are permanent regression tests (FR-013, FR-013a, FR-013b)', () => {
  for (const mutator of HISTORICAL_CAUSE_MUTATORS) {
    describe(mutator.id, () => {
      const check = SINGLE_SOURCE_CHECKS[mutator.targetCheckId];

      it('the mutator actually changes the live component source (guards against a silently-defeated mutator)', () => {
        expect(mutator.mutate(toolbar)).not.toBe(toolbar);
      });

      it("today's real component source passes the targeted check", () => {
        expect(allOk(check(toolbar))).toBe(true);
      });

      it('the mutated source fails the targeted check, with a message naming the component, invariant, assumption, and what was found (FR-014, SC-001, SC-011)', () => {
        const outcome = check(mutator.mutate(toolbar));
        const results = Array.isArray(outcome) ? outcome : [outcome];
        const failure = results.find((result) => !result.ok);
        expect(failure, 'expected the mutated source to fail at least one result').toBeDefined();
        expect(failure!.component).toBeTruthy();
        expect(failure!.invariant).toBeTruthy();
        expect(failure!.assumption).toBeTruthy();
        expect(failure!.found).toBeTruthy();
        expect(formatFailure(failure!)).toContain(failure!.component);
      });
    });
  }
});

describe('the closed allowlist rejects an unrecognized guarded declaration (FR-018a, SC-013)', () => {
  it('a guarded property the invariant list does not name fails even though no check was written for it specifically', () => {
    const controlBlock = extractRuleBlock(toolbar, '.control {');
    // max-width matches GUARDED_PROPERTY_PATTERN but is not a key in CONTROL_ALLOWED_DECLARATIONS
    // — nobody anticipated it, so it must fail as unrecognized rather than pass silently.
    const mutatedSource = toolbar.replace(controlBlock, `${controlBlock}\n    max-width: 999px;`);
    const results = checkControlGuardedDeclarations(mutatedSource);
    const maxWidthResult = results.find((result) => result.found.startsWith('max-width'));
    expect(maxWidthResult, 'expected a result for the injected max-width declaration').toBeDefined();
    expect(maxWidthResult!.ok, formatFailure(maxWidthResult!)).toBe(false);
    expect(maxWidthResult!.found).toContain('unrecognized');
  });
});

describe('a purely cosmetic mutation stays green (FR-015, SC-012)', () => {
  it('changing a box-shadow colour and a conic-gradient stop leaves every toolbar check passing', () => {
    const cosmeticSource = toolbar
      .replace('0 2px 6px rgba(90, 61, 102, 0.16)', '0 2px 6px rgba(10, 10, 10, 0.5)')
      .replace('#ff5ca8,\n          #ffc93c,', '#00ffcc,\n          #ffc93c,');
    expect(cosmeticSource).not.toBe(toolbar);

    for (const checkId of Object.keys(SINGLE_SOURCE_CHECKS)) {
      const outcome = SINGLE_SOURCE_CHECKS[checkId](cosmeticSource);
      expect(allOk(outcome), `${checkId} should stay green after a purely cosmetic change`).toBe(true);
    }
  });
});
