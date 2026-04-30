import { readVariables } from './reader/variables';
import { readPaintStyles } from './reader/paint_styles';
import { readEffectStyles } from './reader/effect_styles';
import { readTextStyles } from './reader/text_styles';
import { validate } from './ir/validate';
import type { IR } from './ir/types';
import { emitPackage } from './generator/emit';

figma.showUI(__html__, { width: 400, height: 300 });

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === 'export') {
    try {
      const ir: IR = {
        version: '1.0',
        fileKey: figma.fileKey ?? 'unknown',
        generatedAt: new Date().toISOString(),
        collections: await readVariables(),
        composites: {
          paintStyles: await readPaintStyles(),
          effectStyles: await readEffectStyles(),
          textStyles: await readTextStyles(),
        },
      };

      const result = validate(ir);
      console.log('Validation:', {
        errors: result.errors.length,
        warnings: result.warnings.length,
      });
      if (result.warnings.length > 0) {
        console.log('Warnings:', result.warnings);
      }

      if (result.errors.length > 0) {
        console.error('Validation errors — emit blocked:', result.errors);
        figma.ui.postMessage({
          type: 'validation-errors',
          errors: result.errors,
        });
        return;
      }

      // Phase 4: generate Dart package in-memory (Phase 6 handles ZIP/download).
      const files = emitPackage(ir, 'design_system');
      console.log(
        `Generated ${files.length} files`,
        files.map((f) => f.path),
      );
      figma.ui.postMessage({
        type: 'done',
        warnings: result.warnings,
        generated: {
          fileCount: files.length,
        },
      });
    } catch (err) {
      console.error('Export failed:', err);
      figma.ui.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
