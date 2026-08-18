import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * استعادة موضع التمرير:
 * - التنقل لصفحة جديدة (PUSH/REPLACE) يبدأ من الأعلى.
 * - الرجوع أو التقدّم (POP) يعيد المستخدم إلى موضعه السابق.
 *
 * نسجّل الموضع أثناء التمرير نفسه ولا ننتظر لحظة المغادرة، لأن المتصفح
 * يصفّر التمرير فور استبدال محتوى الصفحة — فيُحفظ صفر بدل الموضع الحقيقي.
 */
export default function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map());
  const currentKey = useRef(location.key);

  // تسجيل مستمر لموضع التمرير للمفتاح الحالي.
  useEffect(() => {
    currentKey.current = location.key;
    let frame = 0;

    const record = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        positions.current.set(currentKey.current, window.scrollY);
      });
    };

    window.addEventListener('scroll', record, { passive: true });
    window.addEventListener('beforeunload', record);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', record);
      window.removeEventListener('beforeunload', record);
    };
  }, [location.key]);

  // الاستعادة بعد رسم المحتوى الجديد.
  useEffect(() => {
    const saved = positions.current.get(location.key);

    if (navigationType === 'POP') {
      // رجوع/تقدّم: نعيد الموضع المحفوظ إن وُجد،
      // وإلا نترك المتصفح يتولى الاستعادة بنفسه (لا نقفز إلى الأعلى).
      if (typeof saved !== 'number' || saved <= 0) return undefined;

      // محتوى الصفحة يصل من طبقة الخدمات بعد لحظات، وقبل وصوله تكون الصفحة
      // أقصر من الموضع المحفوظ فيُقصّ التمرير. لذا نحاول لفترة قصيرة
      // حتى يصبح الارتفاع كافيًا، ونتوقف فور نجاح الاستعادة أو انتهاء المهلة.
      let cancelled = false;
      let frame = 0;
      const deadline = Date.now() + 1500;

      const attempt = () => {
        if (cancelled) return;
        window.scrollTo({ top: saved, behavior: 'auto' });
        const reached = Math.abs(window.scrollY - saved) <= 2;
        if (!reached && Date.now() < deadline) {
          frame = requestAnimationFrame(attempt);
        } else {
          // نعيد تثبيت القيمة المحفوظة لأن التمرير البرمجي حدّثها.
          positions.current.set(location.key, saved);
        }
      };

      frame = requestAnimationFrame(attempt);
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }

    // صفحة جديدة: نبدأ من الأعلى.
    window.scrollTo({ top: 0, behavior: 'auto' });
    return undefined;
  }, [location.key, navigationType]);

  return null;
}
