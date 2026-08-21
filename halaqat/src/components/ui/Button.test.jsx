import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../../test/utils.jsx';
import Button from './Button.jsx';

describe('الزر', () => {
  it('ينفّذ onClick', async () => {
    const onClick = vi.fn();
    renderWithProviders(<Button onClick={onClick}>حفظ</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('يعرض نص التحميل ويمنع النقر أثناءه', async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button onClick={onClick} status="loading" loadingText="جارٍ الحفظ...">
        حفظ
      </Button>,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(screen.getByText('جارٍ الحفظ...')).toBeInTheDocument();

    await userEvent.click(button, { pointerEventsCheck: 0 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('يعرض حالة النجاح', () => {
    renderWithProviders(
      <Button status="success" successText="تم الحفظ ✓">
        حفظ
      </Button>,
    );
    expect(screen.getByText('تم الحفظ ✓')).toBeInTheDocument();
  });

  it('المعطّل لا يستجيب', async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button onClick={onClick} disabled>
        حفظ
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'), { pointerEventsCheck: 0 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('يمكن استخدامه كرابط داخلي', () => {
    renderWithProviders(<Button to="/app/student">الرئيسية</Button>);
    expect(screen.getByRole('link', { name: 'الرئيسية' })).toHaveAttribute('href', '/app/student');
  });
});
