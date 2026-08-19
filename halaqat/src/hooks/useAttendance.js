import { useCallback, useState } from 'react';
import { useT } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as teacherService from '../services/teacherService.js';

/**
 * ضبط حضور الطلاب من أي شاشة.
 *
 * المنطق واحد عند المعلم وعند المشرف، فوُضع في مكان واحد: قفل الصف أثناء
 * الحفظ، ورسالة تقول ما حدث بالضبط، وإعادة الحالة السابقة إن فشل الحفظ
 * فلا يبقى الاختيار في الشاشة على قيمة لم تُكتب في البيانات.
 */
export default function useAttendance({ onSaved } = {}) {
  const t = useT();
  const toast = useToast();
  const { role, user } = useAuth();
  const [pending, setPending] = useState({});

  const setAttendance = useCallback(
    async (row, status) => {
      if (status === (row.attendanceToday ?? row.status)) return false;

      setPending((current) => ({ ...current, [row.id]: status }));
      try {
        await teacherService.setAttendance({
          studentId: row.id,
          status,
          role,
          userId: user?.userId,
        });
        toast.success(
          status === 'notRecorded'
            ? t('teacher.attendanceCleared', { name: row.name })
            : t('teacher.attendanceSaved', {
                name: row.name,
                status: t(`teacher.attendanceStatus.${status}`),
              }),
        );
        await onSaved?.();
        return true;
      } catch (error) {
        toast.error(t(error?.messageKey ?? 'state.errorHint'));
        return false;
      } finally {
        setPending((current) => {
          const next = { ...current };
          delete next[row.id];
          return next;
        });
      }
    },
    [role, user?.userId, t, toast, onSaved],
  );

  return { pending, setAttendance };
}
