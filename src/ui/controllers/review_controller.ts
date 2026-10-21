import type { DiffSummary, ExportSummary, PreviewFile } from '../lib/messages';
import { highlight } from '../lib/highlight';

export interface TreeNode {
  name: string;
  type: 'dir' | 'file';
  path: string;
  children?: Map<string, TreeNode>;
  size?: number;
}

export const ICON_FOLDER =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1.5 3.5a1 1 0 0 1 1-1h2l1 1h4a1 1 0 0 1 1 1V9a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3.5Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>';
export const ICON_FILE =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 1.5h4l2.5 2.5V10a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M7 1.5V4h2.5" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>';

export function buildTree(files: PreviewFile[]): TreeNode {
  const root: TreeNode = { name: '', type: 'dir', path: '', children: new Map() };
  for (const f of files) {
    const parts = f.path.split('/');
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const map = cur.children!;
      let next = map.get(name);
      if (!next) {
        next = isLast
          ? { name, type: 'file', path: f.path, size: f.size }
          : {
              name,
              type: 'dir',
              path: parts.slice(0, i + 1).join('/'),
              children: new Map(),
            };
        map.set(name, next);
      }
      cur = next;
    }
  }
  return root;
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function pickInitialFile(files: PreviewFile[]): string | null {
  const preferred = files.find(
    (f) =>
      /^lib\/[^/]+\.dart$/.test(f.path) ||
      /^src\/index\.ts$/.test(f.path) ||
      /^pubspec\.yaml$/.test(f.path) ||
      /^package\.json$/.test(f.path),
  );
  return preferred?.path ?? files[0]?.path ?? null;
}

export function wireCopy(btn: HTMLButtonElement, getText: () => string): void {
  btn.addEventListener('click', async () => {
    const text = getText();
    if (!text) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
        } catch {
          /* ignore */
        }
        document.body.removeChild(ta);
      }
    }
    btn.classList.add('is-copied');
    const original = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => {
      btn.classList.remove('is-copied');
      btn.textContent = original;
    }, 1400);
  });
}

export interface ReviewControllerElements {
  diffBar: HTMLElement;
  fileTree: HTMLElement;
  reviewSummary: HTMLElement;
  codeTitle: HTMLElement;
  codeViewer: HTMLElement;
  copyCodeBtn: HTMLButtonElement;
  backFromReviewBtn?: HTMLButtonElement;
}

export interface ReviewControllerOptions {
  elements: ReviewControllerElements;
  onBack?: () => void;
}

export class ReviewController {
  private diffBar: HTMLElement;
  private fileTree: HTMLElement;
  private reviewSummary: HTMLElement;
  private codeTitle: HTMLElement;
  private codeViewer: HTMLElement;
  private copyCodeBtn: HTMLButtonElement;
  private backFromReviewBtn?: HTMLButtonElement;

  private files: PreviewFile[] = [];
  private selectedPath: string | null = null;
  private onBack?: () => void;

  constructor(options: ReviewControllerOptions) {
    this.diffBar = options.elements.diffBar;
    this.fileTree = options.elements.fileTree;
    this.reviewSummary = options.elements.reviewSummary;
    this.codeTitle = options.elements.codeTitle;
    this.codeViewer = options.elements.codeViewer;
    this.copyCodeBtn = options.elements.copyCodeBtn;
    this.backFromReviewBtn = options.elements.backFromReviewBtn;
    this.onBack = options.onBack;

    this.bindEvents();
  }

  private bindEvents(): void {
    wireCopy(this.copyCodeBtn, () => this.codeViewer.textContent || '');
    if (this.backFromReviewBtn) {
      this.backFromReviewBtn.addEventListener('click', () => {
        if (this.onBack) this.onBack();
      });
    }
  }

  public renderReview(files: PreviewFile[], diff: DiffSummary, summary: ExportSummary): void {
    this.files = files;
    this.selectedPath = null;
    this.renderDiffBar(diff);
    this.renderTree(files);
    this.reviewSummary.textContent = `${summary.fileCount} files · ${fmtSize(summary.totalBytes)}`;
    this.codeTitle.textContent = 'Select a file';
    this.codeViewer.textContent = 'Pick a file from the tree above to preview its contents.';
    this.copyCodeBtn.classList.remove('hidden');

    const initial = pickInitialFile(files);
    if (initial) {
      this.selectFile(initial);
    }
  }

  public renderDiffBar(diff: DiffSummary): void {
    const total = diff.added + diff.removed + diff.renamed;
    if (total === 0) {
      this.diffBar.innerHTML =
        '<span class="diff-chip diff-chip--neutral">No changes since last export</span>';
      return;
    }
    const chips: string[] = [];
    if (diff.added > 0)
      chips.push(`<span class="diff-chip diff-chip--added">+${diff.added} added</span>`);
    if (diff.removed > 0)
      chips.push(`<span class="diff-chip diff-chip--removed">−${diff.removed} removed</span>`);
    if (diff.renamed > 0)
      chips.push(`<span class="diff-chip diff-chip--renamed">~${diff.renamed} renamed</span>`);
    this.diffBar.innerHTML = chips.join('');
  }

  public renderTree(files: PreviewFile[]): void {
    this.fileTree.innerHTML = '';
    const root = buildTree(files);

    const walk = (node: TreeNode, depth: number) => {
      if (!node.children) return;
      const entries = [...node.children.values()].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const child of entries) {
        const row = document.createElement('div');
        row.className = `tree-row tree-row--${child.type}`;
        row.style.paddingLeft = `${depth * 12 + 12}px`;
        if (child.type === 'dir') {
          row.innerHTML = `${ICON_FOLDER}<span class="tree-row__name">${escapeHtml(child.name)}</span>`;
          this.fileTree.appendChild(row);
          walk(child, depth + 1);
        } else {
          row.dataset.path = child.path;
          row.innerHTML =
            `${ICON_FILE}<span class="tree-row__name">${escapeHtml(child.name)}</span>` +
            `<span class="tree-row__size">${fmtSize(child.size ?? 0)}</span>`;
          row.addEventListener('click', () => this.selectFile(child.path));
          this.fileTree.appendChild(row);
        }
      }
    };
    walk(root, 0);
  }

  public selectFile(path: string): void {
    this.selectedPath = path;
    const file = this.files.find((f) => f.path === path);
    if (!file) return;

    this.codeTitle.textContent = path;
    this.codeViewer.innerHTML = highlight(file.contents, path);
    this.copyCodeBtn.classList.remove('hidden');

    this.fileTree.querySelectorAll<HTMLElement>('.tree-row--file').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.path === path);
    });
  }

  public getSelectedPath(): string | null {
    return this.selectedPath;
  }

  public getFiles(): PreviewFile[] {
    return [...this.files];
  }
}
