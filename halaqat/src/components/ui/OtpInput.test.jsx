import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { renderWithProviders, screen, userEvent } from '../../test/utils.jsx';
import OtpInput from './OtpInput.jsx';

function Harness({ onComplete }) {
  const [value, setValue] = useState('');
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />;
}

describe('حقل رمز التحقق', () => {
  it('يعرض ست خانات لكل منها وصف', () => {
    renderWithProviders(<Harness />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
    expect(inputs[0]).toHaveAccessibleName('الخانة 1 من 6');
  });

  it('ينتقل تلقائيًا بين الخانات ويستدعي onComplete', async () => {
    const onComplete = vi.fn();
    renderWithProviders(<Harness onComplete={onComplete} />);
    const inputs = screen.getAllByRole('textbox');

    await userEvent.type(inputs[0], '1');
    await userEvent.type(inputs[1], '2');
    await userEvent.type(inputs[2], '3');
    await userEvent.type(inputs[3], '4');
    await userEvent.type(inputs[4], '5');
    await userEvent.type(inputs[5], '6');

    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('يتجاهل الأحرف غير الرقمية', async () => {
    renderWithProviders(<Harness />);
    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[0], 'أ');
    expect(inputs[0]).toHaveValue('');
  });

  it('يدعم Backspace للحذف والرجوع', async () => {
    renderWithProviders(<Harness />);
    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[0], '1');
    await userEvent.type(inputs[1], '2');
    await userEvent.keyboard('{Backspace}');
    expect(inputs[1]).toHaveValue('');
  });
});
