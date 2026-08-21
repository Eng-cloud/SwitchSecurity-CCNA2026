import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * إعلان تغيّر الصفحة لقارئ الشاشة.
 * في تطبيقات الصفحة الواحدة لا يعلن المتصفح الانتقال تلقائيًا،
 * لذا نقرأ عنوان المستند بعد كل تنقل.
 */
export default function RouteAnnouncer() {
  const location = useLocation();
  const [message, setMessage] = useState('');

  useEffect(() => {
    // ننتظر حتى تضبط الصفحة عنوانها (useDocumentTitle) قبل الإعلان.
    const timer = setTimeout(() => {
      setMessage(document.title);
    }, 350);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div
      className="visually-hidden"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="route-announcer"
    >
      {message}
    </div>
  );
}
