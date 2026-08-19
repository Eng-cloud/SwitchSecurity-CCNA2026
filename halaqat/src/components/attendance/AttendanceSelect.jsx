import { useT } from '../../i18n/index.jsx';
import { Select } from '../ui/index.js';

/** لون كل حالة من سُلَّم الشارات نفسه، فلا يفترق معنى الأخضر بين عمود وآخر. */
export const ATTENDANCE_VARIANT = {
  notRecorded: 'neutral',
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'info',
};

/** «لم يُسجَّل» أولًا: هي حالة اليوم قبل أن يُلمس، وهي أيضًا طريق التراجع. */
export const ATTENDANCE_OPTIONS = ['notRecorded', 'present', 'late', 'absent', 'excused'];

/**
 * الحضور حالةٌ تُضبط في مكانها.
 *
 * ليس زرًّا يُسجّل ثم يُعطَّل نفسه: النقر بالخطأ واقعة يومية، فالضبط يقبل
 * كل الحالات ويقبل الإلغاء. يُستعمل لحضور الطالب ولحضور المعلم معًا
 * لأن القاعدة واحدة، وإن اختلف من يُسأل عنها.
 */
export default function AttendanceSelect({
  value,
  name,
  onChange,
  busy = false,
  disabled = false,
  labelKey = 'teacher.attendanceLabel',
  options = ATTENDANCE_OPTIONS,
  ...rest
}) {
  const t = useT();

  return (
    <Select
      className="select--attendance"
      data-variant={ATTENDANCE_VARIANT[value]}
      aria-label={t(labelKey, { name })}
      aria-busy={busy || undefined}
      value={value}
      disabled={disabled || busy}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {t(`teacher.attendanceStatus.${option}`)}
        </option>
      ))}
    </Select>
  );
}
