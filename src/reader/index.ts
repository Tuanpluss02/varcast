import type { IR } from '../ir/types';
import { readVariables } from './variables';
import { readPaintStyles } from './paint_styles';
import { readEffectStyles } from './effect_styles';
import { readTextStyles } from './text_styles';

export { readVariables } from './variables';
export { readPaintStyles } from './paint_styles';
export { readEffectStyles } from './effect_styles';
export { readTextStyles } from './text_styles';

/**
 * Unified factory to read all Figma design tokens into an IR instance.
 */
export async function readIR(fileKey?: string): Promise<IR> {
  const [collections, paintStyles, effectStyles, textStyles] = await Promise.all([
    readVariables(),
    readPaintStyles(),
    readEffectStyles(),
    readTextStyles(),
  ]);

  return {
    version: '1.0',
    fileKey: fileKey ?? figma.fileKey ?? 'unknown',
    generatedAt: new Date().toISOString(),
    collections,
    composites: {
      paintStyles,
      effectStyles,
      textStyles,
    },
  };
}
