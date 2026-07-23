// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { test, expect, vi, beforeEach } from 'vitest';
import ToggleTheme from '@/components/toggle-theme';
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { LOCAL_STORAGE_KEYS } from '@/constants';
import { syncWithLocalTheme } from '@/actions/theme';

const themeClientMocks = vi.hoisted(() => ({
  getCurrentThemeMode: vi.fn(),
  setThemeMode: vi.fn(),
  toggleThemeMode: vi.fn(),
}));

vi.mock('@/ipc/manager', () => ({
  ipc: {
    client: {
      theme: themeClientMocks,
    },
  },
}));

function ThemeProbe() {
  const { theme } = useTheme();

  return <div data-testid="theme-probe">{theme}</div>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  themeClientMocks.getCurrentThemeMode.mockReset();
  themeClientMocks.setThemeMode.mockReset();
  themeClientMocks.toggleThemeMode.mockReset();
  themeClientMocks.getCurrentThemeMode.mockResolvedValue('dark');
  themeClientMocks.setThemeMode.mockResolvedValue('dark');
  themeClientMocks.toggleThemeMode.mockResolvedValue(true);
});

test('renders ToggleTheme', () => {
  const { getByRole } = render(<ToggleTheme />);
  const isButton = getByRole('button');

  expect(isButton).toBeTruthy();
});

test('has icon', () => {
  const { getByRole } = render(<ToggleTheme />);
  const button = getByRole('button');
  const icon = button.querySelector('svg');

  expect(icon).toBeTruthy();
});

test('is moon icon', () => {
  const svgIconClassName: string = 'lucide-moon';
  const { getByRole } = render(<ToggleTheme />);
  const svg = getByRole('button').querySelector('svg');

  expect(svg?.classList).toContain(svgIconClassName);
});

test('defaults ThemeProvider to dark when no preference is stored', () => {
  const { getByTestId } = render(
    <ThemeProvider storageKey={LOCAL_STORAGE_KEYS.THEME} defaultTheme="dark">
      <ThemeProbe />
    </ThemeProvider>,
  );

  expect(getByTestId('theme-probe').textContent).toBe('dark');
  expect(document.documentElement.classList).toContain('dark');
});

test('syncWithLocalTheme falls back to dark when there is no saved preference', async () => {
  await syncWithLocalTheme();

  expect(themeClientMocks.setThemeMode).toHaveBeenCalledWith('dark');
  expect(localStorage.getItem(LOCAL_STORAGE_KEYS.THEME)).toBe('dark');
  expect(document.documentElement.classList).toContain('dark');
});
