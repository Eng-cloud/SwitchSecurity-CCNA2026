import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../test/utils.jsx';
import { useTheme } from './ThemeContext.jsx';
import { readStorage } from '../lib/storage.js';

function ThemeProbe() {
  const { mode, resolved, setMode } = useTheme();
  return (
    <div>
      <p data-testid="mode">{mode}</p>
      <p data-testid="resolved">{resolved}</p>
      <button type="button" onClick={() => setMode('dark')}>
        داكن
      </button>
      <button type="button" onClick={() => setMode('system')}>
        النظام
      </button>
    </div>
  );
}

describe('مزوّد المظهر', () => {
  it('يبدأ بوضع النظام افتراضيًا', () => {
    renderWithProviders(<ThemeProbe />);
    expect(screen.getByTestId('mode')).toHaveTextContent('system');
  });

  it('يبدّل إلى الداكن ويكتبه على عنصر الجذر', async () => {
    renderWithProviders(<ThemeProbe />);
    await userEvent.click(screen.getByRole('button', { name: 'داكن' }));

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
  });

  it('يحفظ الاختيار في التخزين المحلي', async () => {
    renderWithProviders(<ThemeProbe />);
    await userEvent.click(screen.getByRole('button', { name: 'داكن' }));
    expect(readStorage('theme')).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: 'النظام' }));
    expect(readStorage('theme')).toBe('system');
  });
});
