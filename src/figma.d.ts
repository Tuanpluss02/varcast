export {};

declare global {
  const __html__: string;
  const figma: {
    showUI(html: string, options?: unknown): void;
    ui: {
      onmessage: ((msg: unknown) => void | Promise<void>) | undefined;
      postMessage(pluginMessage: unknown, options?: unknown): void;
    };
    closePlugin(message?: string): void;
    fileKey?: string;
    clientStorage: {
      getAsync(key: string): Promise<unknown>;
      setAsync(key: string, value: unknown): Promise<void>;
    };
    variables: {
      getLocalVariableCollectionsAsync(): Promise<VariableCollection[]>;
      getLocalVariablesAsync(): Promise<Variable[]>;
    };
    getLocalPaintStylesAsync(): Promise<PaintStyle[]>;
    getLocalEffectStylesAsync(): Promise<EffectStyle[]>;
    getLocalTextStylesAsync(): Promise<TextStyle[]>;
  };

  interface VariableMode {
    modeId: string;
    name: string;
  }

  interface VariableCollection {
    id: string;
    name: string;
    modes: VariableMode[];
  }

  interface Variable {
    id: string;
    name: string;
    variableCollectionId: string;
    resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
    scopes?: unknown[];
    hiddenFromPublishing: boolean;
    valuesByMode: Record<string, unknown>;
  }

  type VariableValue = VariableAlias | RGBA | number | string | boolean;
  type VariableAlias = { type: 'VARIABLE_ALIAS'; id: string };

  interface PaintStyle {
    id: string;
    name: string;
    paints: ReadonlyArray<SolidPaint | GradientPaint | ImagePaint>;
  }

  interface SolidPaint {
    type: 'SOLID';
    color: { r: number; g: number; b: number };
    opacity?: number;
    boundVariables?: Record<string, VariableAlias>;
  }

  interface GradientPaint {
    type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND';
    gradientTransform: Transform;
    gradientStops: ColorStop[];
  }

  interface ImagePaint {
    type: 'IMAGE';
  }

  type Transform = [[number, number, number], [number, number, number]];

  interface ColorStop {
    position: number;
    color: { r: number; g: number; b: number; a?: number };
    boundVariables?: Record<string, VariableAlias>;
  }

  type EffectStyle = any;
  type Effect = any;
  type DropShadowEffect = any;
  type InnerShadowEffect = any;

  type TextStyle = any;
  type LineHeight = any;
  type LetterSpacing = any;
  type FontName = { family: string; style: string };
}

