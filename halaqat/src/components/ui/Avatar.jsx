import cn from '../../lib/cn.js';
import { initials } from '../../lib/format.js';

/**
 * صورة رمزية نصية (بلا صور خارجية).
 * زخرفية بالنسبة لقارئ الشاشة لأن الاسم مكتوب بجانبها دائمًا،
 * ما لم يُمرَّر `label` صراحةً.
 */
export default function Avatar({ name, size = 'md', label, className }) {
  return (
    <span
      className={cn('avatar', size !== 'md' && `avatar--${size}`, className)}
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {initials(name)}
    </span>
  );
}
