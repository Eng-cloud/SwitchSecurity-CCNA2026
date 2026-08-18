import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as adminService from '../../services/adminService.js';
import { formatNumber } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Button,
  Field,
  Input,
  Select,
  Switch,
  Alert,
  DataState,
  Skeleton,
} from '../../components/ui/index.js';

/** إعدادات المنصة (تجريبية). */
export default function AdminSettings() {
  const t = useT();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('idle');

  const fetcher = useCallback(() => adminService.getPlatformSettings(), []);
  const { data, loading, error, refetch } = useAsyncData(fetcher, []);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('loading');
    try {
      await adminService.updatePlatformSettings(form);
      setStatus('success');
      toast.success(t('admin.settingsSaved'));
    } catch {
      setStatus('idle');
      toast.error(t('state.errorHint'));
    }
  };

  return (
    <>
      <PageHeader
        title={t('admin.settingsTitle')}
        subtitle={t('admin.settingsSubtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/admin' }, { label: t('nav.settings') }]}
      />

      <DataState
        loading={loading || !form}
        error={error}
        onRetry={refetch}
        isEmpty={false}
        loadingFallback={<Skeleton variant="card" height={280} />}
      >
        {form ? (
          <Card className="stack-5">
            <form className="stack-5" onSubmit={handleSubmit}>
              <Field label={t('admin.platformName')} required>
                <Input
                  value={form.platformName}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, platformName: event.target.value }))
                  }
                />
              </Field>

              <Field label={t('admin.defaultGoal')}>
                <Select
                  value={form.defaultGoal}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, defaultGoal: Number(event.target.value) }))
                  }
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {formatNumber(value)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Switch
                label={t('admin.allowRegistration')}
                checked={form.allowRegistration}
                onChange={(checked) => setForm((prev) => ({ ...prev, allowRegistration: checked }))}
              />

              <Switch
                label={t('admin.maintenanceMode')}
                checked={form.maintenanceMode}
                onChange={(checked) => setForm((prev) => ({ ...prev, maintenanceMode: checked }))}
              />

              <Button
                type="submit"
                status={status}
                loadingText={t('common.saving')}
                successText={t('common.saved')}
              >
                {t('common.save')}
              </Button>
            </form>

            <Alert variant="mock">{t('app.mockNotice')}</Alert>
          </Card>
        ) : null}
      </DataState>
    </>
  );
}
