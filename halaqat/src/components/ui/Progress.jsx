import cn from '../../lib/cn.js';
import { clamp, formatPercent } from '../../lib/format.js';

/** شريط تقدم مع قيمة نصية دائمة (لا يعتمد على اللون وحده). */
export function ProgressBar({
  value,
  max = 100,
  label,
  valueText,
  variant = 'brand',
  showValue = true,
  className,
  id,
}) {
  const percent = clamp((Number(value) / (Number(max) || 1)) * 100, 0, 100);
  const text = valueText ?? formatPercent(percent);

  return (
    <div className={cn('progress', className)}>
      {label || showValue ? (
        <div className="progress__head">
          {label ? (
            <span className="t-secondary" id={id ? `${id}-label` : undefined}>
              {label}
            </span>
          ) : (
            <span />
          )}
          {showValue ? <span className="progress__value tnum">{text}</span> : null}
        </div>
      ) : null}
      <div
        className="progress__track"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={text}
        aria-labelledby={label && id ? `${id}-label` : undefined}
        aria-label={!label ? text : undefined}
      >
        <div
          className={cn('progress__bar', variant !== 'brand' && `progress__bar--${variant}`)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** حلقة تقدم للنِسب المهمة (الإتقان مثلًا). */
export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  label,
  valueText,
  color = 'var(--brand-600)',
  trackColor = 'var(--surface-3)',
}) {
  const percent = clamp(value, 0, 100);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const text = valueText ?? formatPercent(percent);

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={label ? `${label}: ${text}` : text}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          className="ring__circle"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring__label" aria-hidden="true">
        {text}
      </span>
    </div>
  );
}
