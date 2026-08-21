import { forwardRef, useId } from 'react';
import cn from '../../lib/cn.js';
import { useT } from '../../i18n/index.jsx';
import { IconButton } from './Button.jsx';

export const Input = forwardRef(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn('input', className)} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn('textarea', className)} {...rest} />;
});

export const Select = forwardRef(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn('select', className)} {...rest}>
      {children}
    </select>
  );
});

/** حقل بحث مع أيقونة وزر مسح — يُستخدم في كل القوائم. */
export const SearchInput = forwardRef(function SearchInput(
  { value, onChange, onClear, label, placeholder, className, id, ...rest },
  ref,
) {
  const t = useT();
  const generatedId = useId();
  const inputId = id ?? `search-${generatedId}`;

  return (
    <div className={cn('input-group', className)}>
      <label className="visually-hidden" htmlFor={inputId}>
        {label ?? t('search.label')}
      </label>
      <span className="input-group__icon" aria-hidden="true">
        🔍
      </span>
      <input
        ref={ref}
        id={inputId}
        type="search"
        className="input"
        value={value}
        placeholder={placeholder ?? t('common.searchPlaceholder')}
        onChange={(event) => onChange?.(event.target.value)}
        {...rest}
      />
      {value ? (
        <IconButton
          className="input-group__clear"
          label={t('search.clear')}
          onClick={() => {
            onClear ? onClear() : onChange?.('');
          }}
        >
          ✕
        </IconButton>
      ) : null}
    </div>
  );
});

export default Input;
