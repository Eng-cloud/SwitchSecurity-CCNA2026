import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import * as assistantService from '../services/assistantService.js';

/**
 * مهمة المساعد الحالية للطالب — تُقرأ من التوكيلات لا من الدور.
 *
 * تعيد `null` لغير الطلاب ولمن لا توكيل له، فتختفي واجهة المساعد تلقائيًا
 * بمجرد انتهاء المهمة دون إعادة تحميل الصفحة.
 */
export default function useAssistantDuty() {
  const { role, user } = useAuth();
  const studentId = user?.studentId ?? null;
  const [duty, setDuty] = useState(null);

  const load = useCallback(() => {
    if (role !== 'student' || !studentId) {
      setDuty(null);
      return Promise.resolve(null);
    }
    return assistantService
      .getMyDuty(studentId)
      .then((next) => {
        setDuty(next);
        return next;
      })
      .catch(() => {
        // انقطاع الاتصال المحاكى لا يجوز أن يُسقط الهيكل العام.
        setDuty(null);
        return null;
      });
  }, [role, studentId]);

  useEffect(() => {
    load();
    return assistantService.subscribeDelegations(load);
  }, [load]);

  return { duty, reload: load };
}
