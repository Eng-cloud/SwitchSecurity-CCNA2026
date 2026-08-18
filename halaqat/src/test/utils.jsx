import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n/index.jsx';
import { ThemeProvider } from '../context/ThemeContext.jsx';
import { A11yProvider } from '../context/A11yContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

/** يغلّف المكوّن بكل المزوّدات مثل التطبيق الحقيقي. */
export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <I18nProvider>
      <ThemeProvider>
        <A11yProvider>
          <ToastProvider>
            <AuthProvider>
              <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
            </AuthProvider>
          </ToastProvider>
        </A11yProvider>
      </ThemeProvider>
    </I18nProvider>,
  );
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
