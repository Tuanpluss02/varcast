import type { UiToPluginMessage, ValidationErrorMsg } from '../lib/messages';
import { formatError, postToPlugin } from '../lib/messages';

export interface ExportControllerElements {
  exportBtn: HTMLButtonElement;
  loadingOverlay: HTMLElement;
  loadingTitle: HTMLElement;
  loadingSub: HTMLElement;
  statusEl?: HTMLElement;
  downloadZipBtn?: HTMLButtonElement;
  errTitle?: HTMLElement;
  errList?: HTMLElement;
}

export interface ExportControllerOptions {
  elements: ExportControllerElements;
  postMessage?: (msg: UiToPluginMessage) => void;
  navigateTo?: (screen: 'home' | 'review' | 'errors') => void;
  getExportOptions?: () => unknown;
}

export class ExportController {
  private exportBtn: HTMLButtonElement;
  private loadingOverlay: HTMLElement;
  private loadingTitle: HTMLElement;
  private loadingSub: HTMLElement;
  private statusEl?: HTMLElement;
  private downloadZipBtn?: HTMLButtonElement;
  private errTitle?: HTMLElement;
  private errList?: HTMLElement;

  private postMessage: (msg: UiToPluginMessage) => void;
  private navigateTo?: (screen: 'home' | 'review' | 'errors') => void;
  private getExportOptions?: () => unknown;

  constructor(options: ExportControllerOptions) {
    this.exportBtn = options.elements.exportBtn;
    this.loadingOverlay = options.elements.loadingOverlay;
    this.loadingTitle = options.elements.loadingTitle;
    this.loadingSub = options.elements.loadingSub;
    this.statusEl = options.elements.statusEl;
    this.downloadZipBtn = options.elements.downloadZipBtn;
    this.errTitle = options.elements.errTitle;
    this.errList = options.elements.errList;

    this.postMessage = options.postMessage ?? postToPlugin;
    this.navigateTo = options.navigateTo;
    this.getExportOptions = options.getExportOptions;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.exportBtn.addEventListener('click', () => this.startExport());
    if (this.downloadZipBtn) {
      this.downloadZipBtn.addEventListener('click', () => this.startDownloadZip());
    }
  }

  public showLoading(title: string, sub: string): void {
    this.loadingTitle.textContent = title;
    this.loadingSub.textContent = sub;
    this.loadingOverlay.classList.add('is-open');
    this.loadingOverlay.setAttribute('aria-hidden', 'false');
  }

  public hideLoading(): void {
    this.loadingOverlay.classList.remove('is-open');
    this.loadingOverlay.setAttribute('aria-hidden', 'true');
  }

  public startExport(optionsOverride?: unknown): void {
    this.exportBtn.disabled = true;
    if (this.statusEl) this.statusEl.textContent = '';
    this.showLoading('Validating…', 'Reading tokens and styles from Figma.');

    const options = optionsOverride ?? (this.getExportOptions ? this.getExportOptions() : {});
    this.postMessage({ type: 'export', options });
  }

  public startDownloadZip(): void {
    if (this.downloadZipBtn) this.downloadZipBtn.disabled = true;
    this.showLoading('Packing zip…', 'Almost there.');
    this.postMessage({ type: 'download-zip' });
  }

  public handleExporting(): void {
    this.showLoading('Packing zip…', 'Almost there.');
  }

  public handleValidationErrors(errors: ValidationErrorMsg[]): void {
    this.hideLoading();
    this.exportBtn.disabled = false;
    const errs = errors || [];
    if (this.errTitle) {
      this.errTitle.textContent = `${errs.length} error${errs.length === 1 ? '' : 's'}`;
    }
    if (this.errList) {
      this.errList.textContent = errs.map(formatError).join('\n');
    }
    if (this.navigateTo) {
      this.navigateTo('errors');
    }
  }

  public handleError(message: string): void {
    this.hideLoading();
    this.exportBtn.disabled = false;
    if (this.downloadZipBtn) {
      this.downloadZipBtn.disabled = false;
    }
    if (this.statusEl) {
      this.statusEl.textContent = 'Error: ' + message;
    }
  }

  public handleZipReady(bytes: Uint8Array, filename = 'design_system.zip'): void {
    this.hideLoading();
    if (this.downloadZipBtn) {
      this.downloadZipBtn.disabled = false;
    }
    this.triggerDownload(bytes, filename);
  }

  public triggerDownload(bytes: Uint8Array, filename: string): void {
    if (typeof URL === 'undefined' || typeof document === 'undefined') return;
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as any);
    const blob = new Blob([arr.buffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  public resetButtons(): void {
    this.exportBtn.disabled = false;
    if (this.downloadZipBtn) {
      this.downloadZipBtn.disabled = false;
    }
  }
}
