import { useId, useState } from 'react';
import cn from '../../lib/cn.js';

/** طيّ المحتوى الثانوي — من أدوات "المعلومات على طبقات". */
export default function Accordion({ items, defaultOpen = [], allowMultiple = true, className }) {
  const baseId = useId();
  const [open, setOpen] = useState(() => new Set(defaultOpen));

  const toggle = (id) => {
    setOpen((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={cn('accordion', className)}>
      {items.map((item) => {
        const isOpen = open.has(item.id);
        return (
          <div className="accordion__item" key={item.id}>
            <h3>
              <button
                type="button"
                className="accordion__trigger"
                aria-expanded={isOpen}
                aria-controls={`${baseId}-${item.id}`}
                id={`${baseId}-trigger-${item.id}`}
                onClick={() => toggle(item.id)}
              >
                <span>{item.title}</span>
                <span className="accordion__icon" aria-hidden="true">
                  ⌄
                </span>
              </button>
            </h3>
            <div
              className="accordion__panel"
              id={`${baseId}-${item.id}`}
              role="region"
              aria-labelledby={`${baseId}-trigger-${item.id}`}
              hidden={!isOpen}
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
