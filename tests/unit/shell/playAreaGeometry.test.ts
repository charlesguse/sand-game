import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { GEOMETRY_INVARIANTS, type GeometryComponent, type GeometryCategory } from './geometryInvariants';
import {
  formatFailure,
  checkCanvasSizeDerivation,
  checkPlayAreaGuardedDeclarations,
  checkArrangementSingleSource,
} from './geometryGate';

const playArea = readFileSync(fileURLToPath(new URL('../../../src/lib/PlayArea.svelte', import.meta.url)), 'utf8');
const app = readFileSync(fileURLToPath(new URL('../../../src/App.svelte', import.meta.url)), 'utf8');
const toolbar = readFileSync(fileURLToPath(new URL('../../../src/lib/Toolbar.svelte', import.meta.url)), 'utf8');
const layoutSource = readFileSync(fileURLToPath(new URL('../../../src/lib/layout.ts', import.meta.url)), 'utf8');

// Story 4 — the play area gets the same derived-or-pinned protection the toolbar does (FR-001a,
// FR-001b, FR-009, FR-010).
describe('the play area matches the layout model (FR-001a, FR-001b)', () => {
  it("the canvas's on-screen box is derived from computePlayField's displayWidth/displayHeight through one inline-style channel", () => {
    const result = checkCanvasSizeDerivation(playArea);
    expect(result.ok, formatFailure(result)).toBe(true);
  });

  it('the closed-allowlist scan passes over .play-area-container and .play-area today, and would fail immediately on any future unrecognized guarded declaration', () => {
    const results = checkPlayAreaGuardedDeclarations(playArea);
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.ok, formatFailure(result)).toBe(true);
    }
  });
});

describe('arrangement has exactly one source of truth (Story 4 Acceptance Scenario 3)', () => {
  it('App.svelte and Toolbar.svelte both read readArrangement()/RAIL_MEDIA_QUERY from layout.ts, with no independently-thresholded @media rule left in either', () => {
    const result = checkArrangementSingleSource(app, toolbar);
    expect(result.ok, formatFailure(result)).toBe(true);
  });
});

describe('the pinch-zoom hazard has no code path left to trigger (Story 4 Acceptance Scenario 4, SC-014)', () => {
  it("readArrangement's implementation never reads window.visualViewport", () => {
    const startIndex = layoutSource.indexOf('export function readArrangement');
    expect(startIndex).toBeGreaterThan(-1);
    const nextExportIndex = layoutSource.indexOf('export ', startIndex + 'export function readArrangement'.length);
    const readArrangementSource = layoutSource.slice(startIndex, nextExportIndex === -1 ? undefined : nextExportIndex);
    expect(readArrangementSource).not.toContain('visualViewport');
  });
});

const COMPONENTS: readonly GeometryComponent[] = ['toolbar-band', 'toolbar-control', 'play-area-container', 'play-area-canvas'];
const CATEGORIES: readonly GeometryCategory[] = [
  'box-sizing',
  'borders',
  'padding',
  'margins',
  'flow-direction',
  'wrapping',
  'gaps',
  'transforms',
  'sizing',
];

describe('GEOMETRY_INVARIANTS covers every (component, category) pair (FR-009)', () => {
  for (const component of COMPONENTS) {
    for (const category of CATEGORIES) {
      it(`has an entry for (${component}, ${category})`, () => {
        const hasEntry = GEOMETRY_INVARIANTS.some((invariant) => invariant.component === component && invariant.category === category);
        expect(hasEntry).toBe(true);
      });
    }
  }
});

// Every geometryGate.ts export that performs an assertion (as opposed to a mutator, a formatter,
// or a parsing primitive) — kept as a plain list here so this test fails loudly if a future check
// is added but never wired into GEOMETRY_INVARIANTS, or vice versa (FR-010).
const ASSERTION_CHECK_IDS = [
  'checkControlBoxSizing',
  'checkControlGuardedDeclarations',
  'checkSelectedGuardedDeclarations',
  'checkRailFlowDirection',
  'checkBandWrapping',
  'checkBandBoxSizing',
  'checkBandSafeAreaPadding',
  'checkGapAxes',
  'checkArrangementSingleSource',
  'checkCanvasSizeDerivation',
  'checkPlayAreaGuardedDeclarations',
];

describe('every invariant with a checkId names a real check, and every check is named by at least one invariant (FR-010)', () => {
  // FR-010's correspondence is about every entry that names a check (mechanism 'pinned', plus
  // play-area-canvas-sizing's 'derived'-but-structurally-checked entry, T019) — not only 'pinned'
  // ones, since checkCanvasSizeDerivation verifies the derivation channel itself is real rather
  // than pinning a value.
  const entriesWithCheckId = GEOMETRY_INVARIANTS.filter((invariant) => invariant.checkId !== undefined);
  const namedCheckIds = [...new Set(entriesWithCheckId.map((invariant) => invariant.checkId as string))];

  it('every entry with a checkId names a real geometryGate.ts export', () => {
    for (const invariant of entriesWithCheckId) {
      expect(ASSERTION_CHECK_IDS, `invariant "${invariant.id}" names unknown check "${invariant.checkId}"`).toContain(
        invariant.checkId,
      );
    }
  });

  it('every assertion export of geometryGate.ts is named by at least one invariant', () => {
    for (const checkId of ASSERTION_CHECK_IDS) {
      expect(namedCheckIds, `check "${checkId}" is exported but no GEOMETRY_INVARIANTS entry names it`).toContain(checkId);
    }
  });
});
