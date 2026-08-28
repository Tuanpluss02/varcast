export type ExportOptions = {
  targetId: string;
  packageName: string;
  include: {
    collections?: string[];
    composites: {
      colorStyles: boolean;
      shadows: boolean;
      textStyles: boolean;
    };
  };
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
  getSelectedCollectionIds?: () => string[];
  getCompositeSelection?: () => {
    colorStyles: boolean;
    shadows: boolean;
    textStyles: boolean;
  };
}): ExportOptions {
  const { targetId, packageName, getSelectedCollectionIds, getCompositeSelection } = opts;
  const selectedCols = getSelectedCollectionIds ? getSelectedCollectionIds() : undefined;
  const composites = getCompositeSelection
    ? getCompositeSelection()
    : { colorStyles: true, shadows: true, textStyles: true };

  return {
    targetId: targetId.value || 'flutter',
    packageName: packageName.value || 'design_system',
    include: {
      collections: selectedCols,
      composites,
    },
  };
}

export function pillText(o: ExportOptions, totalCollections?: number): string {
  const bits: string[] = [];
  bits.push(o.targetId === 'flutter' ? 'Flutter' : 'React Native');
  if (o.include.collections && totalCollections !== undefined) {
    if (o.include.collections.length === totalCollections) bits.push('All collections');
    else bits.push(`${o.include.collections.length}/${totalCollections} collections`);
  } else {
    bits.push('All collections');
  }

  const customized =
    !o.include.composites.colorStyles ||
    !o.include.composites.shadows ||
    !o.include.composites.textStyles;

  bits.push(customized ? 'customized' : 'defaults');
  return bits.join(' · ');
}
