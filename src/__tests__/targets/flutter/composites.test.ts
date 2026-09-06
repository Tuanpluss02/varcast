import { describe, it, expect } from 'vitest';
import type {
  IRPaintStyle,
  IREffectStyle,
  IRTextStyle,
} from '../../../ir/types';
import {
  emitColorStyles,
  emitShadows,
  emitTextStyles,
} from '../../../targets/flutter/generator/composites';
import type {
  PreparedPaintStyle,
  PreparedEffectStyle,
  PreparedTextStyle,
} from '../../../targets/flutter/generator/prepare';

function emptyVarIndex(): Map<string, never> {
  return new Map<string, never>();
}

function makePreparedPaint(getterName: string, raw: IRPaintStyle): PreparedPaintStyle {
  return { id: raw.id, type: raw.type, groupName: 'Paint', getterName, raw };
}

function makePreparedEffect(getterName: string, raw: IREffectStyle): PreparedEffectStyle {
  return { id: raw.id, type: raw.type, groupName: 'Effect', getterName, raw };
}

function makePreparedText(getterName: string, raw: IRTextStyle): PreparedTextStyle {
  return { id: raw.id, groupName: 'Text', getterName, raw };
}

describe('emitColorStyles LinearGradient', () => {
  it('emits LinearGradient syntax with 2 stops', () => {
    const style = makePreparedPaint('primaryGradient', {
      id: 'paint:linear', figmaName: 'Primary Gradient', groupPath: ['Primary'],
      type: 'GRADIENT_LINEAR', angleRadians: Math.PI / 2,
      stops: [
        { position: 0, color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } } },
        { position: 1, color: { kind: 'literal', rgba: { r: 0, g: 0, b: 1, a: 1 } } },
      ],
    });
    const out = emitColorStyles([style], emptyVarIndex());
    expect(out).toContain('LinearGradient get primaryGradient => LinearGradient(');
    expect(out).toContain('begin:');
    expect(out).toContain('end:');
    expect(out).toContain('stops: const [0.0, 1.0]');
    expect(out).toContain('const Color(0xFFFF0000)');
    expect(out).toContain('const Color(0xFF0000FF)');
  });

  it('emits 3 gradient stops in correct order', () => {
    const style = makePreparedPaint('triGradient', {
      id: 'paint:linear3', figmaName: 'Tri Gradient', groupPath: [],
      type: 'GRADIENT_LINEAR', angleRadians: 0,
      stops: [
        { position: 0,   color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } } },
        { position: 0.5, color: { kind: 'literal', rgba: { r: 0, g: 1, b: 0, a: 1 } } },
        { position: 1,   color: { kind: 'literal', rgba: { r: 0, g: 0, b: 1, a: 1 } } },
      ],
    });
    const out = emitColorStyles([style], emptyVarIndex());
    expect(out).toContain('stops: const [0.0, 0.5, 1.0]');
    expect(out).toContain('const Color(0xFFFF0000)');
    expect(out).toContain('const Color(0xFF00FF00)');
    expect(out).toContain('const Color(0xFF0000FF)');
  });

  it('wraps stop colors in a colors: [...] list', () => {
    const style = makePreparedPaint('gradA', {
      id: 'paint:la', figmaName: 'Gradient A', groupPath: [],
      type: 'GRADIENT_LINEAR', angleRadians: 0,
      stops: [
        { position: 0, color: { kind: 'literal', rgba: { r: 1, g: 1, b: 1, a: 1 } } },
        { position: 1, color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 1 } } },
      ],
    });
    const out = emitColorStyles([style], emptyVarIndex());
    expect(out).toContain('colors: [');
  });
});

describe('emitColorStyles RadialGradient', () => {
  it('emits valid Dart RadialGradient(...) syntax', () => {
    const style = makePreparedPaint('radialBg', {
      id: 'paint:radial', figmaName: 'Radial Bg', groupPath: ['Bg'],
      type: 'GRADIENT_RADIAL', center: { x: 0.5, y: 0.5 }, radius: 0.5,
      stops: [
        { position: 0, color: { kind: 'literal', rgba: { r: 1, g: 1, b: 1, a: 1 } } },
        { position: 1, color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 1 } } },
      ],
    });
    const out = emitColorStyles([style], emptyVarIndex());
    expect(out).toContain('RadialGradient get radialBg => RadialGradient(');
    expect(out).toContain('center: Alignment(');
    expect(out).toContain('radius:');
    expect(out).toContain('stops: const [0.0, 1.0]');
    expect(out).toContain('const Color(0xFFFFFFFF)');
    expect(out).toContain('const Color(0xFF000000)');
  });

  it('maps center (0.5, 0.5) to Alignment(0.0, 0.0)', () => {
    const style = makePreparedPaint('centeredRadial', {
      id: 'paint:rc', figmaName: 'Centered Radial', groupPath: [],
      type: 'GRADIENT_RADIAL', center: { x: 0.5, y: 0.5 }, radius: 0.5,
      stops: [
        { position: 0, color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } } },
        { position: 1, color: { kind: 'literal', rgba: { r: 0, g: 1, b: 0, a: 1 } } },
      ],
    });
    const out = emitColorStyles([style], emptyVarIndex());
    expect(out).toContain('center: Alignment(0.0, 0.0)');
  });

  it('doubles the radius value in the emitted output', () => {
    const style = makePreparedPaint('offCenterRadial', {
      id: 'paint:roc', figmaName: 'Off Center Radial', groupPath: [],
      type: 'GRADIENT_RADIAL', center: { x: 0.25, y: 0.75 }, radius: 0.4,
      stops: [
        { position: 0, color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } } },
        { position: 1, color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 1 } } },
      ],
    });
    const out = emitColorStyles([style], emptyVarIndex());
    expect(out).toContain('radius: 0.8');
  });
});

describe('emitShadows DropShadow', () => {
  it('emits BoxShadow syntax with spread and blur', () => {
    const style = makePreparedEffect('shadowMd', {
      id: 'effect:md', figmaName: 'Shadow/Md', groupPath: ['Shadow'],
      type: 'DROP_SHADOW',
      color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.25 } },
      offsetX: 0, offsetY: 4, blurRadius: 8, spreadRadius: 2,
    });
    const out = emitShadows([style], emptyVarIndex());
    expect(out).toContain('List<DSShadow> get shadowMd =>');
    expect(out).toContain('DSShadow(');
    expect(out).toContain('color:');
    expect(out).toContain('offset:');
    expect(out).toContain('blurRadius: 8.0');
    expect(out).toContain('spreadRadius: 2.0');
    expect(out).toContain('blurStyle: BlurStyle.normal');
  });

  it('emits correct Offset(x, y) values', () => {
    const style = makePreparedEffect('shadowOffset', {
      id: 'effect:offset', figmaName: 'Shadow/Offset', groupPath: ['Shadow'],
      type: 'DROP_SHADOW',
      color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.5 } },
      offsetX: 3, offsetY: 6, blurRadius: 4, spreadRadius: 0,
    });
    const out = emitShadows([style], emptyVarIndex());
    expect(out).toContain('Offset(3.0, 6.0)');
  });

  it('emits BlurStyle.normal for DROP_SHADOW', () => {
    const style = makePreparedEffect('dropSh', {
      id: 'effect:drop', figmaName: 'Drop/Shadow', groupPath: [],
      type: 'DROP_SHADOW',
      color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 1 } },
      offsetX: 0, offsetY: 2, blurRadius: 4, spreadRadius: 0,
    });
    const out = emitShadows([style], emptyVarIndex());
    expect(out).toContain('BlurStyle.normal');
    expect(out).not.toContain('BlurStyle.inner');
  });

  it('emits BlurStyle.inner for INNER_SHADOW', () => {
    const style = makePreparedEffect('innerSh', {
      id: 'effect:inner', figmaName: 'Inner/Shadow', groupPath: [],
      type: 'INNER_SHADOW',
      color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 1 } },
      offsetX: 0, offsetY: 2, blurRadius: 4, spreadRadius: 0,
    });
    const out = emitShadows([style], emptyVarIndex());
    expect(out).toContain('BlurStyle.inner');
  });

  it('wraps the shadow in a List<DSShadow> getter', () => {
    const style = makePreparedEffect('shadowSm', {
      id: 'effect:sm', figmaName: 'Shadow/Sm', groupPath: [],
      type: 'DROP_SHADOW',
      color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.1 } },
      offsetX: 0, offsetY: 1, blurRadius: 2, spreadRadius: 0,
    });
    const out = emitShadows([style], emptyVarIndex());
    expect(out).toContain('List<DSShadow> get shadowSm =>');
  });
});

describe('emitTextStyles letterSpacing', () => {
  it('emits pixel letterSpacing as a raw double literal with no fs multiplication', () => {
    const style = makePreparedText('headingLg', {
      id: 'text:hLg', figmaName: 'Heading/Lg', groupPath: ['Heading'],
      fontFamily: { kind: 'literal', value: 'Inter' },
      fontSize: { kind: 'literal', value: 24 },
      fontWeight: { kind: 'literal', value: 700 },
      lineHeight: { kind: 'literal', value: 32, unit: 'PIXELS' },
      letterSpacing: { kind: 'literal', value: 0.5, unit: 'PIXELS' },
    });
    const out = emitTextStyles([style], emptyVarIndex());
    expect(out).toContain('letterSpacing: 0.5');
    expect(out).not.toMatch(/letterSpacing:.*\* fs/);
  });

  it('emits percent letterSpacing as a (fraction * fs) expression', () => {
    const style = makePreparedText('bodyMd', {
      id: 'text:bMd', figmaName: 'Body/Md', groupPath: ['Body'],
      fontFamily: { kind: 'literal', value: 'Inter' },
      fontSize: { kind: 'literal', value: 16 },
      fontWeight: { kind: 'literal', value: 400 },
      lineHeight: { kind: 'literal', value: 100, unit: 'PERCENT' },
      letterSpacing: { kind: 'literal', value: 5, unit: 'PERCENT' },
    });
    const out = emitTextStyles([style], emptyVarIndex());
    expect(out).toContain('letterSpacing: (0.05 * fs)');
  });

  it('emits zero pixel letterSpacing as 0.0', () => {
    const style = makePreparedText('captionSm', {
      id: 'text:cSm', figmaName: 'Caption/Sm', groupPath: [],
      fontFamily: { kind: 'literal', value: 'Roboto' },
      fontSize: { kind: 'literal', value: 12 },
      fontWeight: { kind: 'literal', value: 400 },
      lineHeight: { kind: 'literal', value: 0, unit: 'AUTO' },
      letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
    });
    const out = emitTextStyles([style], emptyVarIndex());
    expect(out).toContain('letterSpacing: 0.0');
  });
});

describe('emitTextStyles lineHeight', () => {
  it('emits AUTO lineHeight as null', () => {
    const style = makePreparedText('bodyAuto', {
      id: 'text:auto', figmaName: 'Body/Auto', groupPath: [],
      fontFamily: { kind: 'literal', value: 'Inter' },
      fontSize: { kind: 'literal', value: 16 },
      fontWeight: { kind: 'literal', value: 400 },
      lineHeight: { kind: 'literal', value: 0, unit: 'AUTO' },
      letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
    });
    const out = emitTextStyles([style], emptyVarIndex());
    expect(out).toContain('height: null');
  });

  it('emits PIXELS lineHeight as (value / fs)', () => {
    const style = makePreparedText('bodyPx', {
      id: 'text:bpx', figmaName: 'Body/Px', groupPath: [],
      fontFamily: { kind: 'literal', value: 'Inter' },
      fontSize: { kind: 'literal', value: 16 },
      fontWeight: { kind: 'literal', value: 400 },
      lineHeight: { kind: 'literal', value: 24, unit: 'PIXELS' },
      letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
    });
    const out = emitTextStyles([style], emptyVarIndex());
    expect(out).toContain('height: (24.0 / fs)');
  });

  it('emits PERCENT lineHeight as plain fraction without fs division', () => {
    const style = makePreparedText('bodyPct', {
      id: 'text:bpct', figmaName: 'Body/Pct', groupPath: [],
      fontFamily: { kind: 'literal', value: 'Inter' },
      fontSize: { kind: 'literal', value: 16 },
      fontWeight: { kind: 'literal', value: 400 },
      lineHeight: { kind: 'literal', value: 150, unit: 'PERCENT' },
      letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
    });
    const out = emitTextStyles([style], emptyVarIndex());
    expect(out).toContain('height: 1.5');
    expect(out).not.toContain('height: (1.5');
  });
});

describe('emitTextStyles full typography combined fields', () => {
  it('emits all five fields: fontFamily, fontSize, fontWeight, height, letterSpacing', () => {
    const style = makePreparedText('displayXl', {
      id: 'text:dxl', figmaName: 'Display/XL', groupPath: ['Display'],
      fontFamily: { kind: 'literal', value: 'Neue Haas Grotesk' },
      fontSize: { kind: 'literal', value: 56 },
      fontWeight: { kind: 'literal', value: 700 },
      lineHeight: { kind: 'literal', value: 64, unit: 'PIXELS' },
      letterSpacing: { kind: 'literal', value: -1, unit: 'PIXELS' },
    });
    const out = emitTextStyles([style], emptyVarIndex());
    expect(out).toContain("fontFamily: 'Neue Haas Grotesk'");
    expect(out).toContain('final fs = 56.0');
    expect(out).toContain('fontSize: fs');
    expect(out).toContain('fontWeight: DSTextStyle._bucket(700.0)');
    expect(out).toContain('height: (64.0 / fs)');
    expect(out).toContain('letterSpacing: -1.0');
  });

  it('emits a DSTextStyle getter method body with return statement', () => {
    const style = makePreparedText('labelSm', {
      id: 'text:lSm', figmaName: 'Label/Sm', groupPath: ['Label'],
      fontFamily: { kind: 'literal', value: 'Roboto' },
      fontSize: { kind: 'literal', value: 11 },
      fontWeight: { kind: 'literal', value: 500 },
      lineHeight: { kind: 'literal', value: 16, unit: 'PIXELS' },
      letterSpacing: { kind: 'literal', value: 0.4, unit: 'PIXELS' },
    });
    const out = emitTextStyles([style], emptyVarIndex());
    expect(out).toContain('DSTextStyle get labelSm {');
    expect(out).toContain('return DSTextStyle._(');
  });

  it('includes DSTextStyle class boilerplate and DSStyles class wrapper', () => {
    const out = emitTextStyles([], emptyVarIndex());
    expect(out).toContain('class DSTextStyle extends TextStyle');
    expect(out).toContain('class DSStyles');
    expect(out).toContain('const DSStyles();');
  });
});
