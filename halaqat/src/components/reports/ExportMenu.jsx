import { useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { exportCsv, exportWord, exportPdf } from '../../lib/export.js';
import { Button, Modal } from '../ui/index.js';

/**
 * تصدير التقرير — للمشرف والإدارة.
 *
 * كل صيغة تُسمّى بما هي، وPDF منها موصوفٌ بطريقه الحقيقي: حوار الطباعة
 * ثم «حفظ كـ PDF». وعدُ زرٍّ لا يفي أسوأ من غيابه.
 */
export default function ExportMenu({ data }) {
  const t = useT();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  if (!data?.rows?.length) return null;

  const run = (action, successKey) => {
    try {
      action();
      if (successKey) toast.success(t(successKey));
      setOpen(false);
    } catch {
      toast.error(t('state.errorHint'));
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} data-testid="open-export">
        {t('reports.export')}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('reports.exportTitle')}
        description={t('reports.exportHint', { count: data.rows.length })}
        footer={
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
        }
      >
        <div className="stack-3">
          <Button
            variant="secondary"
            data-testid="export-csv"
            onClick={() => run(() => exportCsv(data), 'reports.exported')}
          >
            {t('reports.exportCsv')}
          </Button>
          <Button
            variant="secondary"
            data-testid="export-word"
            onClick={() => run(() => exportWord(data), 'reports.exported')}
          >
            {t('reports.exportWord')}
          </Button>
          <Button
            variant="secondary"
            data-testid="export-pdf"
            onClick={() => run(() => exportPdf())}
          >
            {t('reports.exportPdf')}
          </Button>
          <p className="t-xs t-muted">{t('reports.exportPdfNote')}</p>
        </div>
      </Modal>
    </>
  );
}
