export type ScreenName =
  | 'home'
  | 'validating'
  | 'errors'
  | 'warnings'
  | 'ready'
  | 'exporting'
  | 'done';

export type Screens = Record<ScreenName, HTMLElement>;

export function showScreen(screens: Screens, name: ScreenName) {
  Object.values(screens).forEach((el) => el.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

