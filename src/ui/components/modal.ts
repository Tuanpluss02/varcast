export type ModalApi = {
  open: (text: string) => void;
  close: () => void;
};

export function setupModal(opts: {
  backdrop: HTMLElement;
  textEl: HTMLElement;
  closeBtn: HTMLElement;
}): ModalApi {
  const { backdrop, textEl, closeBtn } = opts;

  function open(text: string) {
    textEl.textContent = text || 'No changelog yet.';
    backdrop.classList.add('is-open');
  }

  function close() {
    backdrop.classList.remove('is-open');
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.classList.contains('is-open')) {
      close();
    }
  });

  return { open, close };
}
