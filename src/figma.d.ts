// Minimal ambient declarations to make TypeScript tooling happy even when
// `@figma/plugin-typings` isn't present.
//
// This file MUST be a module (export {}) so editors always include it, while
// still declaring globals via `declare global`.

export {};

declare global {
  const __html__: string;
  const figma: any;

  type VariableValue = any;
  type VariableAlias = { type: 'VARIABLE_ALIAS'; id: string };

  type PaintStyle = any;
  type SolidPaint = any;
  type Transform = any;
  type ColorStop = any;

  type EffectStyle = any;
  type Effect = any;
  type DropShadowEffect = any;
  type InnerShadowEffect = any;

  type TextStyle = any;
  type LineHeight = any;
  type LetterSpacing = any;
  type FontName = { family: string; style: string };
}
