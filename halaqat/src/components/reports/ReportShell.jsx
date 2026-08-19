import { useEffect, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { can, ACTIONS } from '../../config/permissions.js';
import { formatDateTime } from '../../lib/format.js';
import { Button, SegmentedControl } from '../ui/index.js';
import Logo from '../layout/Logo.jsx';
import ExportMenu from './ExportMenu.jsx';

/**
 * غلاف موحّد للتقارير:
 * فلاتر الفترة + معاينة الطباعة + رأس/تذييل مخصصان للطباعة.
 */
export default function ReportShell({
  title,
  period,
  onPeriodChange,
  preparedBy,
  filters,
  children,
  actions,
  exportData,
}) {
  const t = useT();
  const { role } = useAuth();
  // الطباعة والتصدير صلاحية واحدة: المشرف والإدارة. المعلم يقرأ ولا يُخرج.
  const canPrint = can(role, ACTIONS.REPORTS_PRINT);
  const [preview, setPreview] = useState(false);
  const printedAt = formatDateTime(new Date());

  // إنهاء المعاينة تلقائيًا بعد إغلاق نافذة الطباعة.
  useEffect(() => {
    const handler = () => setPreview(false);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, []);

  const periods = [
    { value: 'daily', label: t('reports.daily') },
    { value: 'weekly', label: t('reports.weekly') },
    { value: 'monthly', label: t('reports.monthly') },
  ];

  return (
    <div className="stack-5">
      <div className="report-toolbar" data-print="hide">
        {onPeriodChange ? (
          <div className="stack-2">
            <span className="field__label">{t('reports.period')}</span>
            <SegmentedControl
              label={t('reports.period')}
              value={period}
              onChange={onPeriodChange}
              options={periods}
            />
          </div>
        ) : null}

        {filters}

        <div className="row row-2 mis-auto">
          {actions}
          {canPrint ? (
            <>
              <ExportMenu data={exportData} />
              <Button
                variant="secondary"
                onClick={() => setPreview((prev) => !prev)}
                aria-pressed={preview}
              >
                {preview ? t('common.exitPrintPreview') : t('common.printPreview')}
              </Button>
              <Button onClick={() => window.print()} icon="🖨">
                {t('common.print')}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div data-print-preview={preview ? 'true' : 'false'} className="stack-5">
        <header className="print-header">
          <div className="row row-2">
            <Logo size={34} />
            <div>
              <strong>{t('app.name')}</strong>
              <p className="t-xs t-muted">{t('reports.printTitle', { title })}</p>
            </div>
          </div>
          <div className="t-xs t-muted t-end">
            <p>{t('reports.printedOn', { date: printedAt })}</p>
            {preparedBy ? <p>{t('reports.preparedBy', { name: preparedBy })}</p> : null}
          </div>
        </header>

        {children}

        <footer className="print-footer">
          <p>{t('reports.confidential')}</p>
        </footer>
      </div>
    </div>
  );
}
