import { useT } from '../../i18n/index.jsx';
import { Select } from '../ui/index.js';

/** لون كل حالة من سُلَّم الشارات نفسه، فلا يفترق معنى الأخضر بين عمود وآخر. */
export const ATTENDANCE_VARIANT = {
  present: 'success',
  absent: 'danger',
  excused: 'info',
};

/**
 * ثلاث حالات لا رابع لها.
 * «غائب» هي حالة اليوم قبل أن يُلمس: من لم يُسجَّل حضوره لم يحضر، وهذا
 * هو طريق التراجع أيضًا — تسجيلٌ خاطئ يُصحَّح بالعودة إليها.
 */
export const ATTENDANCE_OPTIONS = ['present', 'absent', 'excused'];

/**
 * الحضور حالةٌ تُضبط في مكانها.
 *
 * ليس زرًّا يُسجّل ثم يُعطَّل نفسه: النقر بالخطأ واقعة يومية، فالضبط يقبل
 * الحالات الثلاث في الاتجاهين. يُستعمل لحضور الطالب ولحضور المعلم معًا
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
