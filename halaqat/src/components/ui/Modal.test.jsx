import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../../test/utils.jsx';
import Modal from './Modal.jsx';
import Button from './Button.jsx';

describe('النافذة الحوارية', () => {
  it('تُعلن كـdialog ولها عنوان مرتبط', () => {
    renderWithProviders(
      <Modal open onClose={() => {}} title="إضافة ملاحظة">
        محتوى
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('إضافة ملاحظة');
  });

  it('تُغلق بمفتاح Escape', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Modal open onClose={onClose} title="حوار">
        محتوى
      </Modal>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('تُغلق من زر الإغلاق', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Modal open onClose={onClose} title="حوار">
        محتوى
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('تنقل التركيز إلى داخلها عند الفتح', async () => {
    renderWithProviders(
      <Modal open onClose={() => {}} title="حوار">
        <Button>إجراء</Button>
      </Modal>,
    );
    await waitFor(() => {
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    });
  });

  it('لا تُرسم عندما تكون مغلقة', () => {
    renderWithProviders(
      <Modal open={false} onClose={() => {}} title="حوار">
        محتوى
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
