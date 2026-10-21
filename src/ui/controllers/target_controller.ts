import type { TargetMetadataItem } from '../lib/messages';

export const FALLBACK_TARGETS: TargetMetadataItem[] = [
  { id: 'flutter', displayName: 'Flutter', defaultPackageName: 'design_system' },
  { id: 'react_native', displayName: 'React Native', defaultPackageName: 'design-system' },
];

export interface TargetControllerElements {
  targetSelect: HTMLSelectElement;
  packageNameInput: HTMLInputElement;
}

export class TargetController {
  private targetSelect: HTMLSelectElement;
  private packageNameInput: HTMLInputElement;
  private targets: TargetMetadataItem[] = [];

  constructor(elements: TargetControllerElements) {
    this.targetSelect = elements.targetSelect;
    this.packageNameInput = elements.packageNameInput;
    this.bindEvents();
    // Pre-populate with fallback targets so UI is immediately usable
    this.setAvailableTargets(FALLBACK_TARGETS);
  }

  private bindEvents(): void {
    this.targetSelect.addEventListener('change', () => {
      this.updatePlaceholder();
    });
  }

  public setAvailableTargets(targets: TargetMetadataItem[]): void {
    if (!targets || targets.length === 0) return;
    this.targets = [...targets];

    const currentVal = this.targetSelect.value;
    this.targetSelect.innerHTML = '';

    for (const t of this.targets) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.displayName ?? t.id;
      if (t.id === currentVal || (!currentVal && t.id === 'flutter')) {
        opt.selected = true;
      }
      this.targetSelect.appendChild(opt);
    }

    this.updatePlaceholder();
  }

  public updatePlaceholder(): void {
    const selected = this.getSelectedTarget();
    if (selected) {
      this.packageNameInput.placeholder = selected.defaultPackageName || 'design_system';
    }
  }

  public getSelectedTargetId(): string {
    return this.targetSelect.value;
  }

  public getSelectedTarget(): TargetMetadataItem | undefined {
    const val = this.getSelectedTargetId();
    return this.targets.find((t) => t.id === val);
  }

  public getTarget(id: string): TargetMetadataItem | undefined {
    return this.targets.find((t) => t.id === id);
  }

  public getAllTargets(): TargetMetadataItem[] {
    return [...this.targets];
  }

  public reset(defaultTargetId?: string): void {
    const target = defaultTargetId
      ? this.targets.find((t) => t.id === defaultTargetId)
      : this.targets[0];
    if (target) {
      this.targetSelect.value = target.id;
      this.packageNameInput.value = target.defaultPackageName || 'design_system';
      this.updatePlaceholder();
    }
  }
}
