export type ExportOptions = {
  targetId: string;
  packageName: string;
  include: {
    primitives: boolean;
    tokens: boolean;
    composites: {
      colorStyles: boolean;
      shadows: boolean;
      textStyles: boolean;
    };
    smokeTest: boolean;
  };
  naming: {
    leafPrefix: string;
    leafSuffix: string;
  };
};

export type ToggleEls = {
  primitives: HTMLElement;
  tokens: HTMLElement;
  colorStyles: HTMLElement;
  shadows: HTMLElement;
  textStyles: HTMLElement;
  smokeTest: HTMLElement;
};

export function toggleDataOn(el: HTMLElement) {
  const on = el.dataset.on === 'true';
  el.dataset.on = (!on).toString();
}

export function setToggle(el: HTMLElement, on: boolean) {
  el.dataset.on = on ? 'true' : 'false';
}

export function isToggleOn(el: HTMLElement) {
  return el.dataset.on === 'true';
}

export function collectOptions(opts: {
  targetId: HTMLSelectElement;
  packageName: HTMLInputElement;
  leafPrefix: HTMLInputElement;
  leafSuffix: HTMLInputElement;
  toggles: ToggleEls;
}): ExportOptions {
  const { targetId, packageName, leafPrefix, leafSuffix, toggles } = opts;
  return {
    targetId: targetId.value || 'flutter',
    packageName: packageName.value || 'design_system',
    include: {
      primitives: isToggleOn(toggles.primitives),
      tokens: isToggleOn(toggles.tokens),
      composites: {
        colorStyles: isToggleOn(toggles.colorStyles),
        shadows: isToggleOn(toggles.shadows),
        textStyles: isToggleOn(toggles.textStyles),
      },
      smokeTest: isToggleOn(toggles.smokeTest),
    },
    naming: {
      leafPrefix: leafPrefix.value || '',
      leafSuffix: leafSuffix.value || '',
    },
  };
}

export function pillText(o: ExportOptions): string {
  const bits: string[] = [];
  bits.push(o.targetId === 'flutter' ? 'Flutter' : o.targetId);
  if (o.include.primitives && o.include.tokens) bits.push('Full export');
  else if (o.include.tokens) bits.push('Tokens only');
  else if (o.include.primitives) bits.push('Primitives only');
  else bits.push('Custom');

  const customized =
    Boolean(o.naming.leafPrefix) ||
    Boolean(o.naming.leafSuffix) ||
    !o.include.composites.colorStyles ||
    !o.include.composites.shadows ||
    !o.include.composites.textStyles;

  bits.push(customized ? 'customized' : 'defaults');
  return bits.join(' · ');
}

