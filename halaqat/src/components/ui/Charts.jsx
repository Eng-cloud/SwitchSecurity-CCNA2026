import { useId, useState } from 'react';
import cn from '../../lib/cn.js';
import { useT } from '../../i18n/index.jsx';
import { formatNumber, formatPercent } from '../../lib/format.js';
import Button from './Button.jsx';

/**
 * رسوم SVG خفيفة مبنية داخليًا:
 * - تتبع اتجاه RTL (المحور يبدأ من اليمين).
 * - تستخدم متغيرات الألوان فتعمل في الوضعين الفاتح والداكن والتباين المرتفع.
 * - لكل رسم بديل نصي (جدول بيانات) لأن المعلومة لا يجوز أن تكون بصرية فقط.
 */

const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

function ChartFrame({ title, description, children, data, series, valueFormatter, className }) {
  const t = useT();
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <figure className={cn('chart', className)}>
      {title ? (
        <figcaption className="section__head" style={{ marginBottom: 'var(--space-3)' }}>
          <span className="section__title">{title}</span>
          {description ? <span className="section__hint">{description}</span> : null}
        </figcaption>
      ) : null}

      {children}

      {data?.length ? (
        <>
          <div className="chart__toggle">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTable((prev) => !prev)}
              aria-expanded={showTable}
              aria-controls={tableId}
            >
              {showTable ? t('charts.hideTable') : t('charts.tableAlternative')}
            </Button>
          </div>
          <div id={tableId} hidden={!showTable}>
            <div className="table-wrap">
              <div className="scroll-x">
                <table className="table">
                  <caption className="visually-hidden">
                    {t('charts.summary', { title: title ?? '' })}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('charts.categoryLabel')}</th>
                      {series.map((item) => (
                        <th scope="col" key={item.key}>
                          {item.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        {series.map((item) => (
                          <td key={item.key} className="tnum">
                            {valueFormatter
                              ? valueFormatter(row[item.key])
                              : formatNumber(row[item.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </figure>
  );
}

function Legend({ series }) {
  if (series.length <= 1) return null;
  return (
    <ul className="chart__legend">
      {series.map((item, index) => (
        <li className="chart__legend-item" key={item.key}>
          <span
            className="chart__swatch"
            style={{ background: item.color ?? PALETTE[index % PALETTE.length] }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function EmptyChart() {
  const t = useT();
  return <p className="t-muted t-sm t-center card card--quiet">{t('charts.noData')}</p>;
}

/* =========================================================
   Bar Chart
   ========================================================= */
export function BarChart({
  data = [],
  series = [],
  title,
  description,
  height = 220,
  valueFormatter,
  className,
}) {
  const t = useT();
  if (!data.length || !series.length) return <EmptyChart />;

  const width = 640;
  const padding = { top: 16, right: 40, bottom: 34, left: 40 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const max = Math.max(
    1,
    ...data.flatMap((row) => series.map((item) => Number(row[item.key]) || 0)),
  );
  const groupWidth = innerWidth / data.length;
  const barWidth = Math.min(28, (groupWidth * 0.7) / series.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <ChartFrame
      title={title}
      description={description}
      data={data}
      series={series}
      valueFormatter={valueFormatter}
      className={className}
    >
      <svg
        className="chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t('charts.summary', { title: title ?? '' })}
        preserveAspectRatio="xMidYMid meet"
      >
        {ticks.map((tick) => {
          const y = padding.top + innerHeight - tick * innerHeight;
          return (
            <g key={tick}>
              <line
                className="chart__grid-line"
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
              />
              <text
                className="chart__axis-text"
                x={width - padding.right + 8}
                y={y + 4}
                textAnchor="start"
              >
                {formatNumber(Math.round(max * tick))}
              </text>
            </g>
          );
        })}

        {data.map((row, rowIndex) => {
          // RTL: أول عنصر على اليمين.
          const groupCenter =
            padding.left + innerWidth - (rowIndex + 0.5) * groupWidth;
          return (
            <g key={row.label}>
              {series.map((item, seriesIndex) => {
                const value = Number(row[item.key]) || 0;
                const barHeight = (value / max) * innerHeight;
                const offset =
                  (seriesIndex - (series.length - 1) / 2) * (barWidth + 4);
                return (
                  <rect
                    key={item.key}
                    className="chart__bar"
                    x={groupCenter + offset - barWidth / 2}
                    y={padding.top + innerHeight - barHeight}
                    width={barWidth}
                    height={Math.max(2, barHeight)}
                    rx="3"
                    fill={item.color ?? PALETTE[seriesIndex % PALETTE.length]}
                  >
                    <title>{`${row.label} — ${item.label}: ${
                      valueFormatter ? valueFormatter(value) : formatNumber(value)
                    }`}</title>
                  </rect>
                );
              })}
              <text
                className="chart__axis-text"
                x={groupCenter}
                y={height - 10}
                textAnchor="middle"
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>
      <Legend series={series} />
    </ChartFrame>
  );
}

/* =========================================================
   Line Chart
   ========================================================= */
export function LineChart({
  data = [],
  series = [],
  title,
  description,
  height = 220,
  valueFormatter,
  className,
}) {
  const t = useT();
  if (!data.length || !series.length) return <EmptyChart />;

  const width = 640;
  const padding = { top: 16, right: 40, bottom: 34, left: 40 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const max = Math.max(
    1,
    ...data.flatMap((row) => series.map((item) => Number(row[item.key]) || 0)),
  );
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;
  // RTL: النقطة الأولى على اليمين.
  const pointX = (index) => padding.left + innerWidth - index * stepX;
  const pointY = (value) => padding.top + innerHeight - ((Number(value) || 0) / max) * innerHeight;

  return (
    <ChartFrame
      title={title}
      description={description}
      data={data}
      series={series}
      valueFormatter={valueFormatter}
      className={className}
    >
      <svg
        className="chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t('charts.summary', { title: title ?? '' })}
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + innerHeight - tick * innerHeight;
          return (
            <g key={tick}>
              <line
                className="chart__grid-line"
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
              />
              <text
                className="chart__axis-text"
                x={width - padding.right + 8}
                y={y + 4}
                textAnchor="start"
              >
                {formatNumber(Math.round(max * tick))}
              </text>
            </g>
          );
        })}

        {series.map((item, seriesIndex) => {
          const color = item.color ?? PALETTE[seriesIndex % PALETTE.length];
          const points = data.map((row, index) => `${pointX(index)},${pointY(row[item.key])}`);
          const areaPath = `M ${pointX(0)},${padding.top + innerHeight} L ${points.join(
            ' L ',
          )} L ${pointX(data.length - 1)},${padding.top + innerHeight} Z`;

          return (
            <g key={item.key}>
              <path className="chart__area" d={areaPath} fill={color} />
              <polyline className="chart__line" points={points.join(' ')} stroke={color} />
              {data.map((row, index) => (
                <circle
                  key={row.label}
                  className="chart__point"
                  cx={pointX(index)}
                  cy={pointY(row[item.key])}
                  r="4"
                  fill={color}
                >
                  <title>{`${row.label} — ${item.label}: ${
                    valueFormatter ? valueFormatter(row[item.key]) : formatNumber(row[item.key])
                  }`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {data.map((row, index) => (
          <text
            key={row.label}
            className="chart__axis-text"
            x={pointX(index)}
            y={height - 10}
            textAnchor="middle"
          >
            {row.label}
          </text>
        ))}
      </svg>
      <Legend series={series} />
    </ChartFrame>
  );
}

/* =========================================================
   Donut Chart
   ========================================================= */
export function DonutChart({ data = [], title, description, size = 200, className }) {
  const t = useT();
  if (!data.length) return <EmptyChart />;

  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  const series = [{ key: 'value', label: t('charts.valueLabel') }];
  const tableData = data.map((item) => ({ label: item.label, value: item.value }));

  return (
    <ChartFrame
      title={title}
      description={description}
      data={tableData}
      series={series}
      className={className}
    >
      <div className="row row-6 row-wrap" style={{ justifyContent: 'center' }}>
        <svg
          width={size}
          height={size}
          role="img"
          aria-label={t('charts.summary', { title: title ?? '' })}
        >
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {data.map((item, index) => {
              const value = Number(item.value) || 0;
              const fraction = total > 0 ? value / total : 0;
              const dash = fraction * circumference;
              const offset = -cumulative * circumference;
              cumulative += fraction;
              return (
                <circle
                  key={item.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={item.color ?? PALETTE[index % PALETTE.length]}
                  strokeWidth="22"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                >
                  <title>{`${item.label}: ${formatNumber(value)} (${formatPercent(
                    fraction * 100,
                  )})`}</title>
                </circle>
              );
            })}
          </g>
          <text
            x={size / 2}
            y={size / 2 + 6}
            textAnchor="middle"
            className="chart__axis-text"
            style={{ fontSize: '18px', fill: 'var(--text)', fontWeight: 700 }}
          >
            {formatNumber(total)}
          </text>
        </svg>
        <ul className="stack-2">
          {data.map((item, index) => (
            <li className="chart__legend-item" key={item.label}>
              <span
                className="chart__swatch"
                style={{ background: item.color ?? PALETTE[index % PALETTE.length] }}
                aria-hidden="true"
              />
              <span>{item.label}</span>
              <strong className="tnum">{formatNumber(item.value)}</strong>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
}

/** خط صغير مختصر داخل البطاقات. */
export function Sparkline({ values = [], width = 120, height = 34, color = 'var(--brand-500)', label }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((value, index) => {
    const x = width - index * stepX;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} role="img" aria-label={label} className="chart__svg">
      <polyline className="chart__line" points={points.join(' ')} stroke={color} strokeWidth="2" />
    </svg>
  );
}

export { PALETTE as CHART_PALETTE };
