export type ExportOptions = {
  targetId: string;
  packageName: string;
  archMode: 'context' | 'static';
  include: {
    primitives: boolean;
    tokens: boolean;
    composites: {
      colorStyles: boolean;
      shadows: boolean;
      textStyles: boolean;
    };
  };
};

export type ToggleEls = {
  primitives: HTMLElement;
  tokens: HTMLElement;
  colorStyles: HTMLElement;
  shadows: HTMLElement;
  textStyles: HTMLElement;
  archContext: HTMLElement;
};

export function isToggleOn(el: HTMLElement) {
  return el.getAttribute('aria-checked') === 'true';
}

export function setToggle(el: HTMLElement, on: boolean) {
  el.setAttribute('aria-checked', on ? 'true' : 'false');
}

export function toggleDataOn(el: HTMLElement) {
  setToggle(el, !isToggleOn(el));
}

export function collectOptions(opts: {
  targetId: HTMLSelectElement;
  packageName: HTMLInputElement;
  toggles: ToggleEls;
}): ExportOptions {
  const { targetId, packageName, toggles } = opts;
  return {
    targetId: targetId.value || 'flutter',
    packageName: packageName.value || 'design_system',
    archMode: isToggleOn(toggles.archContext) ? 'context' : 'static',
    include: {
      primitives: isToggleOn(toggles.primitives),
      tokens: isToggleOn(toggles.tokens),
      composites: {
        colorStyles: isToggleOn(toggles.colorStyles),
        shadows: isToggleOn(toggles.shadows),
        textStyles: isToggleOn(toggles.textStyles),
      },
    },
  };
}

export function pillText(o: ExportOptions): string {
  const bits: string[] = [];
  bits.push(o.targetId === 'flutter' ? 'Flutter' : 'React Native');
  if (o.include.primitives && o.include.tokens) bits.push('Full export');
  else if (o.include.tokens) bits.push('Tokens only');
  else if (o.include.primitives) bits.push('Primitives only');
  else bits.push('Custom');

  const customized =
    !o.include.composites.colorStyles ||
    !o.include.composites.shadows ||
    !o.include.composites.textStyles;

  bits.push(customized ? 'customized' : 'defaults');
  if (o.targetId === 'flutter') {
    bits.push(o.archMode === 'context' ? 'context' : 'static');
  }
  return bits.join(' · ');
}
