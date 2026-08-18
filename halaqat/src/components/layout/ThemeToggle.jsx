import { useRef, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useOnClickOutside from '../../hooks/useOnClickOutside.js';
import { IconButton } from '../ui/Button.jsx';

const ICONS = { light: '☀', dark: '🌙', system: '🖥' };

/** مبدّل المظهر: فاتح / داكن / النظام — مع إعلان التغيير لقارئ الشاشة. */
export default function ThemeToggle() {
  const t = useT();
  const { mode, resolved, setMode } = useTheme();
  const { announce } = useToast();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useOnClickOutside(wrapRef, () => setOpen(false), open);

  const choose = (next) => {
    setMode(next);
    setOpen(false);
    announce(t('theme.changed', { mode: t(`theme.${next}`) }));
  };

  return (
    <div className="menu__wrap" ref={wrapRef}>
      <IconButton
        label={`${t('theme.toggle')} — ${t('theme.current', { mode: t(`theme.${mode}`) })}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {ICONS[mode === 'system' ? resolved : mode]}
      </IconButton>

      {open ? (
        <div className="menu" role="menu" aria-label={t('theme.label')}>
          {['light', 'dark', 'system'].map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={mode === option}
              className="menu__item"
              onClick={() => choose(option)}
            >
              <span aria-hidden="true">{ICONS[option]}</span>
              <span className="grow">{t(`theme.${option}`)}</span>
              {mode === option ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
