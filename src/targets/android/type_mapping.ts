import type { TypeMapping } from '../../core/target';
import type { RGBA } from '../../ir/types';
import { boolLiteral, colorLiteral, floatLiteral, stringLiteral } from './compose/emit_helpers';

export const androidTypeMapping: TypeMapping = {
  color: 'Color',
  number: 'Float',
  string: 'String',
  bool: 'Boolean',
  literalColor(rgba: RGBA): string {
    return colorLiteral(rgba);
  },
  literalNumber(n: number): string {
    return floatLiteral(n);
  },
  literalString(s: string): string {
    return stringLiteral(s);
  },
  literalBool(b: boolean): string {
    return boolLiteral(b);
  },
};
