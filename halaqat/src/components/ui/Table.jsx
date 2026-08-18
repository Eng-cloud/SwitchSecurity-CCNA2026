import cn from '../../lib/cn.js';
import { useT } from '../../i18n/index.jsx';
import { formatNumber } from '../../lib/format.js';

/**
 * جدول بيانات:
 * - عناوين أعمدة حقيقية (th/scope) لقارئ الشاشة.
 * - ترتيب بالنقر مع aria-sort.
 * - يتحول إلى بطاقات مكدّسة على الجوال عبر data-label.
 */
export default function Table({
  columns,
  rows,
  getRowKey,
  caption,
  sort,
  onSortChange,
  stacked = true,
  className,
  emptyMessage,
}) {
  const t = useT();

  if (!rows?.length) {
    return (
      <div className="card card--quiet t-center t-muted">{emptyMessage ?? t('table.empty')}</div>
    );
  }

  return (
    <div className={cn('table-wrap', className)}>
      <div className="scroll-x">
        <table className={cn('table', stacked && 'table--stacked')}>
          {caption ? <caption className="visually-hidden">{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                const ariaSort = isSorted
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : column.sortable
                    ? 'none'
                    : undefined;
                return (
                  <th key={column.key} scope="col" aria-sort={ariaSort} style={column.style}>
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        className="table__sort"
                        onClick={() =>
                          onSortChange({
                            key: column.key,
                            direction: isSorted && sort.direction === 'asc' ? 'desc' : 'asc',
                          })
                        }
                        aria-label={t('table.sortBy', { column: column.header })}
                      >
                        {column.header}
                        <span className="table__sort-icon" aria-hidden="true">
                          {isSorted ? (sort.direction === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={getRowKey ? getRowKey(row) : rowIndex}>
                {columns.map((column) => (
                  <td key={column.key} data-label={column.header} style={column.cellStyle}>
                    {column.render ? column.render(row, rowIndex) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** ترقيم صفحات مع معلومات المدى الحالي. */
export function Pagination({ page, totalPages, total, from, to, onChange, className }) {
  const t = useT();
  if (totalPages <= 1) {
    return total ? (
      <div className={cn('pagination', className)}>
        <p className="pagination__info">
          {t('common.showingRange', {
            from: formatNumber(from),
            to: formatNumber(to),
            total: formatNumber(total),
          })}
        </p>
      </div>
    ) : null;
  }

  const pages = [];
  const push = (value) => pages.push(value);
  push(1);
  for (let i = page - 1; i <= page + 1; i += 1) {
    if (i > 1 && i < totalPages) push(i);
  }
  if (totalPages > 1) push(totalPages);
  const unique = [...new Set(pages)].sort((a, b) => a - b);

  return (
    <nav className={cn('pagination', className)} aria-label={t('pagination.label')}>
      <p className="pagination__info">
        {t('common.showingRange', {
          from: formatNumber(from),
          to: formatNumber(to),
          total: formatNumber(total),
        })}
      </p>
      <ul className="pagination__list">
        <li>
          <button
            type="button"
            className="pagination__btn"
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            aria-label={t('pagination.previous')}
          >
            <span aria-hidden="true">›</span>
          </button>
        </li>
        {unique.map((value, index) => {
          const previous = unique[index - 1];
          const gap = previous && value - previous > 1;
          return (
            <li key={value} className="row row-2">
              {gap ? (
                <span className="t-muted" aria-hidden="true">
                  …
                </span>
              ) : null}
              <button
                type="button"
                className="pagination__btn"
                aria-current={value === page ? 'page' : undefined}
                aria-label={
                  value === page
                    ? t('pagination.current', { number: formatNumber(value) })
                    : t('pagination.page', { number: formatNumber(value) })
                }
                onClick={() => onChange(value)}
              >
                {formatNumber(value)}
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className="pagination__btn"
            onClick={() => onChange(page + 1)}
            disabled={page >= totalPages}
            aria-label={t('pagination.next')}
          >
            <span aria-hidden="true">‹</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
