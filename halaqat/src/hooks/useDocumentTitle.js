import { useEffect } from 'react';
import { translate } from '../i18n/index.jsx';

/** يضبط عنوان المستند لكل صفحة (مهم لقارئ الشاشة والتنقل بين التبويبات). */
export default function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return undefined;
    const appName = translate('app.name');
    const previous = document.title;
    document.title = `${title} · ${appName}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
