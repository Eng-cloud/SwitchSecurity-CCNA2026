import { useEffect, useRef } from 'react';
import { useT } from '../../i18n/index.jsx';

const LENGTH = 6;

/**
 * حقل رمز التحقق:
 * تركيز تلقائي، لصق الرمز كاملًا، Backspace، الأسهم، وإدخال أرقام فقط.
 */
export default function OtpInput({ value = '', onChange, onComplete, invalid = false, disabled }) {
  const t = useT();
  const inputsRef = useRef([]);
  const digits = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const setValue = (next) => {
    const cleaned = next.replace(/\D/g, '').slice(0, LENGTH);
    onChange?.(cleaned);
    if (cleaned.length === LENGTH) onComplete?.(cleaned);
    return cleaned;
  };

  const handleChange = (index, raw) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    const chars = value.padEnd(LENGTH, ' ').split('');
    chars[index] = digit;
    const next = setValue(chars.join('').replace(/\s/g, ''));
    const focusIndex = Math.min(LENGTH - 1, next.length);
    inputsRef.current[Math.max(index + 1, focusIndex > index ? index + 1 : index)]?.focus();
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const chars = value.split('');
      if (chars[index]) {
        chars.splice(index, 1);
        setValue(chars.join(''));
        inputsRef.current[index]?.focus();
      } else if (index > 0) {
        chars.splice(index - 1, 1);
        setValue(chars.join(''));
        inputsRef.current[index - 1]?.focus();
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      inputsRef.current[Math.min(LENGTH - 1, index + 1)]?.focus();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      inputsRef.current[Math.max(0, index - 1)]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    if (!pasted) return;
    const next = setValue(pasted);
    inputsRef.current[Math.min(LENGTH - 1, next.length)]?.focus();
  };

  return (
    <div className="otp" onPaste={handlePaste}>
      {Array.from({ length: LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          className="otp__digit"
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          aria-label={t('auth.otp.digitLabel', { index: index + 1 })}
          aria-invalid={invalid ? 'true' : undefined}
          value={digits[index]?.trim() ?? ''}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
          data-testid={`otp-digit-${index}`}
        />
      ))}
    </div>
  );
}
