import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import useFocusTrap, { useScrollLock } from '../../hooks/useFocusTrap.js';
import { normalizeArabic } from '../../mock/api.js';
import { ROLE_HOME } from '../../config/navigation.js';
import { can, ACTIONS } from '../../config/permissions.js';

/**
 * لوحة الأوامر (Ctrl + K):
 * تنقل سريع + إجراءات + تبديل المظهر، مع تنقل بالأسهم وEnter وEscape.
 */
export default function CommandPalette({ open, onClose }) {
  const t = useT();
  const navigate = useNavigate();
  const { role, signOut } = useAuth();
  const { toggle: toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useFocusTrap(panelRef, { active: open, onEscape: onClose, initialFocusRef: inputRef });
  useScrollLock(open);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const commands = useMemo(() => {
    const home = ROLE_HOME[role] ?? '/app';
    const base = [
      {
        id: 'dashboard',
        section: 'navigation',
        label: t('palette.commands.openDashboard'),
        icon: '🏠',
        run: () => navigate(home),
      },
      {
        id: 'notifications',
        section: 'navigation',
        label: t('palette.commands.openNotifications'),
        icon: '🔔',
        run: () => navigate('/app/notifications'),
      },
      {
        id: 'settings',
        section: 'navigation',
        label: t('palette.commands.openSettings'),
        icon: '⚙️',
        run: () => navigate('/app/settings'),
      },
      {
        id: 'a11y',
        section: 'navigation',
        label: t('palette.commands.openAccessibility'),
        icon: '♿',
        run: () => navigate('/app/settings/accessibility'),
      },
      {
        id: 'theme',
        section: 'appearance',
        label: t('palette.commands.toggleTheme'),
        icon: '🌗',
        run: () => toggleTheme(),
      },
      {
        id: 'logout',
        section: 'actions',
        label: t('palette.commands.logout'),
        icon: '↩',
        run: async () => {
          await signOut();
          navigate('/login', { replace: true });
        },
      },
    ];

    // المصحف يظهر لكل دور يملك صلاحية قراءته.
    if (can(role, ACTIONS.QURAN_READ)) {
      base.unshift({
        id: 'quran',
        section: 'navigation',
        label: t('palette.commands.openQuran'),
        icon: '📖',
        run: () => navigate('/app/quran'),
      });
    }

    // التقارير للمعلم والمشرف والإدارة: الطالب يوثّق، وولي الأمر يتابع ابنه.
    if (role !== 'student' && role !== 'parent') {
      base.unshift(
        {
          id: 'searchStudent',
          section: 'actions',
          label: t('palette.commands.searchStudent'),
          icon: '🔍',
          run: () => navigate('/app/search'),
        },
        {
          id: 'reports',
          section: 'navigation',
          label: t('palette.commands.openReports'),
          icon: '📊',
          run: () => navigate(`/app/${role}/reports`),
        },
      );
    }

    return base;
  }, [role, navigate, t, toggleTheme, signOut]);

  const filtered = useMemo(() => {
    const q = normalizeArabic(query);
    if (!q) return commands;
    return commands.filter((command) => normalizeArabic(command.label).includes(q));
  }, [commands, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((command) => {
      if (!map.has(command.section)) map.set(command.section, []);
      map.get(command.section).push(command);
    });
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open || typeof document === 'undefined') return null;

  const runCommand = async (command) => {
    onClose?.();
    await command.run();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = filtered[activeIndex];
      if (command) runCommand(command);
    }
  };

  let runningIndex = -1;

  return createPortal(
    <div
      className="overlay"
      data-command-palette=""
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="palette"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('palette.title')}
      >
        <label className="visually-hidden" htmlFor="palette-input">
          {t('palette.placeholder')}
        </label>
        <input
          id="palette-input"
          ref={inputRef}
          className="palette__input"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('palette.placeholder')}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={filtered[activeIndex] ? `palette-option-${filtered[activeIndex].id}` : undefined}
          autoComplete="off"
        />

        <div className="palette__list" id="palette-list" role="listbox" ref={listRef}>
          {filtered.length === 0 ? (
            <p className="t-sm t-muted" style={{ padding: 'var(--space-4)' }}>
              {t('palette.empty')}
            </p>
          ) : (
            grouped.map(([section, items]) => (
              <div key={section}>
                <p className="palette__group-title">{t(`palette.sections.${section}`)}</p>
                {items.map((command) => {
                  runningIndex += 1;
                  const index = runningIndex;
                  return (
                    <button
                      key={command.id}
                      id={`palette-option-${command.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className="palette__option"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => runCommand(command)}
                    >
                      <span aria-hidden="true">{command.icon}</span>
                      {command.label}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="palette__hint">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> {t('common.next')}
          </span>
          <span>
            <kbd>Esc</kbd> {t('common.close')}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
