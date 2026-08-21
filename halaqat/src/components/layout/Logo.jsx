/**
 * شعار المنصة — حلقات متداخلة بخط ذهبي هادئ.
 * زخرفي بالكامل بالنسبة لقارئ الشاشة (الاسم مكتوب بجانبه).
 */
export default function Logo({ size = 38, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="15" fill="var(--brand-600)" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="var(--gold-500)" strokeWidth="2.6" />
      <circle
        cx="32"
        cy="32"
        r="10.5"
        fill="none"
        stroke="rgba(255,255,255,0.82)"
        strokeWidth="1.8"
      />
      <circle cx="32" cy="13" r="3.4" fill="var(--gold-500)" />
      <circle cx="32" cy="51" r="2.2" fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}

export function BrandMark({ subtitle, size = 38 }) {
  return (
    <>
      <Logo size={size} className="sidebar__logo" />
      <span className="sidebar__brand-text">
        <span className="sidebar__brand-name">منصة الحلقات</span>
        {subtitle ? <span className="sidebar__brand-tag">{subtitle}</span> : null}
      </span>
    </>
  );
}
