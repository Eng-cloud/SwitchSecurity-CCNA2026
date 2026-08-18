import { useId, useRef } from 'react';
import cn from '../../lib/cn.js';

/**
 * تبويبات متوافقة مع نمط ARIA:
 * الأسهم للتنقل (معكوسة في RTL)، Home/End، وربط كل تبويب بلوحته.
 */
export default function Tabs({ tabs, value, onChange, label, className, children }) {
  const baseId = useId();
  const listRef = useRef(null);

  const handleKeyDown = (event) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.value === value);
    const forward = event.key === 'ArrowLeft';
    let nextIndex = index;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else nextIndex = (index + (forward ? 1 : -1) + tabs.length) % tabs.length;

    onChange?.(tabs[nextIndex].value);
    listRef.current?.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
  };

  const activeTab = tabs.find((tab) => tab.value === value) ?? tabs[0];

  return (
    <div className={cn('tabs', className)}>
      <div
        className="tabs__list"
        role="tablist"
        aria-label={label}
        ref={listRef}
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => {
          const selected = tab.value === activeTab?.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.value}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.value}`}
              tabIndex={selected ? 0 : -1}
              className="tabs__tab"
              onClick={() => onChange?.(tab.value)}
            >
              {tab.icon ? <span aria-hidden="true">{tab.icon} </span> : null}
              {tab.label}
              {tab.count != null ? (
                <span className="t-muted tnum"> ({tab.count})</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div
        className="tabs__panel"
        role="tabpanel"
        id={`${baseId}-panel-${activeTab?.value}`}
        aria-labelledby={`${baseId}-tab-${activeTab?.value}`}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}
