import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../test/utils.jsx';
import { useTheme } from './ThemeContext.jsx';
import { readStorage, writeStorage } from '../lib/storage.js';

function ThemeProbe() {
  const { mode, resolved, resolvedMode, setMode } = useTheme();
  return (
    <div>
      <p data-testid="mode">{mode}</p>
      <p data-testid="resolved">{resolved}</p>
      <p data-testid="resolved-mode">{resolvedMode}</p>
      {['calm', 'focus', 'night', 'system'].map((option) => (
        <button key={option} type="button" onClick={() => setMode(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

describe('مزوّد المظهر — أوضاع الواجهة الثلاثة', () => {
  it('يبدأ بوضع النظام افتراضيًا', () => {
    renderWithProviders(<ThemeProbe />);
    expect(screen.getByTestId('mode')).toHaveTextContent('system');
  });

  it('الليل يكتب لوحة داكنة على عنصر الجذر', async () => {
    renderWithProviders(<ThemeProbe />);
    await userEvent.click(screen.getByRole('button', { name: 'night' }));

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
    expect(document.documentElement.getAttribute('data-mode')).toBe('night');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
  });

  it('السكينة والتركيز لوحتهما فاتحة ويفترقان في الوضع', async () => {
    renderWithProviders(<ThemeProbe />);

    await userEvent.click(screen.getByRole('button', { name: 'calm' }));
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-mode')).toBe('calm');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    await userEvent.click(screen.getByRole('button', { name: 'focus' }));
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-mode')).toBe('focus');
    });
    // نفس اللوحة الفاتحة، ووضع مختلف تُبنى عليه فروق التركيز.
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('يحفظ الاختيار في التخزين المحلي', async () => {
    renderWithProviders(<ThemeProbe />);

    await userEvent.click(screen.getByRole('button', { name: 'focus' }));
    expect(readStorage('theme')).toBe('focus');

    await userEvent.click(screen.getByRole('button', { name: 'system' }));
    expect(readStorage('theme')).toBe('system');
  });

  it('يترجم الأسماء القديمة المحفوظة في المتصفح', async () => {
    // مستخدم قديم اختار «داكن» قبل تسمية الأوضاع — يجب ألا يفقد اختياره.
    writeStorage('theme', 'dark');
    renderWithProviders(<ThemeProbe />);

    expect(screen.getByTestId('mode')).toHaveTextContent('night');
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  it('قيمة غير معروفة تعود إلى اتّباع النظام', () => {
    writeStorage('theme', 'neon');
    renderWithProviders(<ThemeProbe />);
    expect(screen.getByTestId('mode')).toHaveTextContent('system');
  });
});
