import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * رجوع يعيد المستخدم من حيث أتى.
 *
 * الرجوع الثابت إلى مسار واحد يخذل المستخدم: من دخل ملف طالب من صفحة الحلقة
 * يريد العودة إليها، لا القفز إلى الرئيسية. فنستعمل سجل التنقل ما دام فيه
 * خطوة سابقة داخل التطبيق، ونسقط إلى المسار البديل عند فتح الرابط مباشرةً.
 *
 * @param {string} fallback المسار البديل حين لا توجد خطوة سابقة.
 */
export default function useGoBack(fallback) {
  const navigate = useNavigate();

  return useCallback(() => {
    // React Router يرقّم خطواته في history.state.idx؛ الصفر يعني أول صفحة.
    const index = window.history.state?.idx;
    if (typeof index === 'number' && index > 0) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  }, [navigate, fallback]);
}
