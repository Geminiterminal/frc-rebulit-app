export interface AppTheme {
  id: string;
  label: string;
  accent: string;
  page: string;
}

export const THEMES: AppTheme[] = [
  { id: 'slate', label: 'Slate', accent: '#5487ab', page: '#0b0e13' },
  { id: 'amber', label: 'Amber', accent: '#e29220', page: '#100e0b' },
  { id: 'green', label: 'Green', accent: '#3aa567', page: '#0c110e' },
  { id: 'blue', label: 'Blue', accent: '#3a78cf', page: '#0c1017' },
  { id: 'red', label: 'Red', accent: '#d64552', page: '#140d0e' },
  { id: 'light', label: 'Light', accent: '#336394', page: '#f4f6f8' },
];

const STORAGE_KEY = 'frc_theme';

export function getTheme(): string {
  return localStorage.getItem(STORAGE_KEY) || 'slate';
}

export function applyTheme(id: string) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme.page);
}

export function saveTheme(id: string) {
  localStorage.setItem(STORAGE_KEY, id);
  applyTheme(id);
}
