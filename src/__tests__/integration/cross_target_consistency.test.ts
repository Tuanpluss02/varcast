/**
 * Cross-target consistency test.
 * Runs both Flutter and React Native targets from the same IR instance
 * and asserts that shared properties (token collection count, fileKey) are consistent.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validate } from '../../ir/validate';
import { runEngine } from '../../core/emit_engine';
import { flutterTarget } from '../../targets/flutter';
import { reactNativeTarget } from '../../targets/react_native';
import type { IR } from '../../ir/types';
import type { EngineOutput } from '../../core/emit_engine';

const IR_PATH = path.resolve(__dirname, '../../../test_fixtures/ir.json');

describe('Cross-target consistency: Flutter vs React Native', () => {
  let flutterOutput: EngineOutput;
  let rnOutput: EngineOutput;
  let ir: IR;

  beforeAll(() => {
    // Parse a fresh copy for each run so validate() mutations don't interfere.
    ir = JSON.parse(fs.readFileSync(IR_PATH, 'utf-8')) as IR;
    const result = validate(ir);
    expect(result.errors).toHaveLength(0);

    flutterOutput = runEngine(ir, [flutterTarget], null, {
      flutter: { packageName: 'design_system' },
    });

    // Re-parse IR because validate() mutates in-place (normalizeIR).
    const ir2: IR = JSON.parse(fs.readFileSync(IR_PATH, 'utf-8')) as IR;
    rnOutput = runEngine(ir2, [reactNativeTarget], null, {
      react_native: { packageName: 'design-system' },
    });
  });

  it('both targets produce non-empty file lists', () => {
    expect(flutterOutput.files.length).toBeGreaterThan(0);
    expect(rnOutput.files.length).toBeGreaterThan(0);
  });

  it('both targets process the same number of token collections', () => {
    // Count collection entries in each manifest's target section.
    const flutterCollectionCount = Object.keys(
      flutterOutput.nextManifest.targets['flutter'].collections,
    ).length;
    const rnCollectionCount = Object.keys(
      rnOutput.nextManifest.targets['react_native'].collections,
    ).length;
    expect(flutterCollectionCount).toBe(rnCollectionCount);
  });

  it('both targets process the same number of variables', () => {
    const flutterVarCount = Object.keys(
      flutterOutput.nextManifest.targets['flutter'].variables,
    ).length;
    const rnVarCount = Object.keys(
      rnOutput.nextManifest.targets['react_native'].variables,
    ).length;
    expect(flutterVarCount).toBe(rnVarCount);
  });

  it('both nextManifests share the same fileKey', () => {
    expect(flutterOutput.nextManifest.fileKey).toBe(rnOutput.nextManifest.fileKey);
  });

  it('both nextManifests carry version 2.0', () => {
    expect(flutterOutput.nextManifest.version).toBe('2.0');
    expect(rnOutput.nextManifest.version).toBe('2.0');
  });

  it('flutter manifest does not contain react_native section (single-target run)', () => {
    expect(flutterOutput.nextManifest.targets['react_native']).toBeUndefined();
  });

  it('rn manifest does not contain flutter section (single-target run)', () => {
    expect(rnOutput.nextManifest.targets['flutter']).toBeUndefined();
  });
});
