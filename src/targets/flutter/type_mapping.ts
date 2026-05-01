import type { RGBA } from '../../ir/types';
import type { TypeMapping } from '../../core/target';
import {
  boolLiteral,
  colorLiteral,
  doubleLiteral,
  stringLiteral,
} from './generator/emit_helpers';

export const flutterTypeMapping: TypeMapping = {
  color: 'Color',
  number: 'double',
  string: 'String',
  bool: 'bool',
  literalColor(rgba: RGBA): string {
    return colorLiteral(rgba);
  },
  literalNumber(n: number): string {
    return doubleLiteral(n);
  },
  literalString(s: string): string {
    return stringLiteral(s);
  },
  literalBool(b: boolean): string {
    return boolLiteral(b);
  },
};

