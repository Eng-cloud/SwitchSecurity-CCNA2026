import { useId } from 'react';
import cn from '../../lib/cn.js';

export function Checkbox({ label, hint, checked, onChange, card = false, className, ...rest }) {
  const id = useId();
  return (
    <label className={cn('choice', card && 'choice--card', className)} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange?.(event.target.checked)}
        {...rest}
      />
      <span className="choice__text">
        {label}
        {hint ? <span className="choice__hint">{hint}</span> : null}
      </span>
    </label>
  );
}

/**
 * مجموعة اختيارات أحادية داخل fieldset/legend
 * لتُقرأ بشكل صحيح في قارئ الشاشة.
 */
export function RadioGroup({ legend, name, value, onChange, options, card = true, className }) {
  return (
    <fieldset className={cn('stack-2', className)} style={{ border: 'none' }}>
      <legend className="field__label" style={{ marginBottom: 'var(--space-2)' }}>
        {legend}
      </legend>
      <div className="stack-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn('choice', card && 'choice--card')}
            htmlFor={`${name}-${option.value}`}
          >
            <input
              id={`${name}-${option.value}`}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange?.(option.value)}
            />
            <span className="choice__text">
              {option.label}
              {option.hint ? <span className="choice__hint">{option.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Switch({ label, hint, checked, onChange, className, ...rest }) {
  const id = useId();
  return (
    <div className={cn('stack-1', className)}>
      <label className="switch" htmlFor={id}>
        <span>
          <span className="choice__text">{label}</span>
          {hint ? <span className="choice__hint">{hint}</span> : null}
        </span>
        <span className="row row-2">
          <input
            id={id}
            type="checkbox"
            role="switch"
            className="visually-hidden"
            checked={checked}
            onChange={(event) => onChange?.(event.target.checked)}
            {...rest}
          />
          <span className="switch__control" aria-hidden="true" />
        </span>
      </label>
    </div>
  );
}

/**
 * مبدّل مجموعات (المظهر، حجم الخط، الفترة...).
 * يُنفَّذ كـ radiogroup ليعمل بالأسهم مع قارئ الشاشة.
 */
export function SegmentedControl({ label, value, onChange, options, block = false, className }) {
  const groupId = useId();

  const handleKeyDown = (event, index) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    // في RTL: السهم الأيسر يتقدم للأمام.
    const forward = event.key === 'ArrowLeft' || event.key === 'ArrowDown';
    let nextIndex = index;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = options.length - 1;
    else nextIndex = (index + (forward ? 1 : -1) + options.length) % options.length;

    onChange?.(options[nextIndex].value);
    const container = document.getElementById(groupId);
    container?.querySelectorAll('[role="radio"]')[nextIndex]?.focus();
  };

  return (
    <div
      className={cn('segmented', block && 'segmented--block', className)}
      role="radiogroup"
      aria-label={label}
      id={groupId}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          className="segmented__option"
          onClick={() => onChange?.(option.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {option.icon ? <span aria-hidden="true">{option.icon}</span> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}
