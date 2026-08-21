import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as coverageService from '../../services/coverageService.js';
import { formatNumber, formatShortDate } from '../../lib/format.js';
import {
  PageHeader,
  Stat,
  Card,
  Table,
  Badge,
  Field,
  Select,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';
import ReportShell from '../../components/reports/ReportShell.jsx';
import { exportColumns } from '../../lib/export.js';

const STATE_VARIANT = {
  onSite: 'success',
  deputized: 'info',
  pending: 'warning',
  needsCover: 'danger',
  escalated: 'danger',
};

/**
 * تقرير تغطية اليوم — للمشرف والإدارة.
 *
 * نفس بيانات لوحة التغطية، ولكن في هيئةٍ تُطبع وتُصدَّر: مصفّاة بالمدينة
 * والحي والجامع، بلا أزرار إجراء. اللوحة للتصرّف، والتقرير للتوثيق.
 */
export default function CoverageReport() {
  const t = useT();
  const { role, user } = useAuth();
  const { values, setValue } = useListState({
    defaults: { city: 'all', district: 'all', mosque: 'all' },
  });

  const fetcher = useCallback(
    () =>
      coverageService.listCoverage({
        role,
        userId: user?.userId,
        city: values.city,
        district: values.district,
        mosque: values.mosque,
      }),
    [role, user?.userId, values.city, values.district, values.mosque],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [
    role,
    user?.userId,
    values.city,
    values.district,
    values.mosque,
  ]);

  const columns = [
    { key: 'circleName', header: t('nav.circle') },
    { key: 'city', header: t('coverage.city') },
    { key: 'district', header: t('coverage.district') },
    { key: 'mosque', header: t('coverage.mosque') },
    {
      key: 'teacherName',
      header: t('nav.teachers'),
      render: (row) => row.teacher?.name ?? '—',
    },
    {
      key: 'teacherStatus',
      header: t('coverage.teacherAttendance'),
      render: (row) => t(`teacher.attendanceStatus.${row.teacherStatus}`),
    },
    {
      key: 'state',
      header: t('coverage.stateHeader'),
      render: (row) => (
        <Badge variant={STATE_VARIANT[row.state]}>{t(`coverage.state.${row.state}`)}</Badge>
      ),
    },
    {
      key: 'deputyName',
      header: t('coverage.deputy'),
      render: (row) =>
        row.state === 'pending' || row.state === 'deputized' ? row.deputation.deputyName : '—',
    },
  ];

  /** صفوف التصدير مسطّحة: القيم كما تُقرأ لا كما تُرسم. */
  const exportRows = (data?.rows ?? []).map((row) => ({
    circleName: row.circleName,
    city: row.city,
    district: row.district,
    mosque: row.mosque,
    teacherName: row.teacher?.name ?? '',
    teacherStatus: t(`teacher.attendanceStatus.${row.teacherStatus}`),
    state: t(`coverage.state.${row.state}`),
    deputyName:
      row.state === 'pending' || row.state === 'deputized' ? row.deputation.deputyName : '',
  }));

  const filterField = (key, label, options) => (
    <Field label={label}>
      <Select
        value={values[key]}
        data-testid={`report-${key}`}
        onChange={(event) => setValue(key, event.target.value)}
      >
        <option value="all">{t('common.all')}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <>
      <PageHeader
        title={t('coverage.reportTitle')}
        subtitle={data ? formatShortDate(data.date) : undefined}
        breadcrumb={[
          { label: t('nav.home'), to: `/app/${role}` },
          { label: t('reports.title'), to: `/app/${role}/reports` },
          { label: t('coverage.reportTitle') },
        ]}
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={false}
        loadingFallback={<PageSkeleton />}
      >
        {data ? (
          <ReportShell
            title={t('coverage.reportTitle')}
            preparedBy={user.name}
            filters={
              <>
                {filterField('city', t('coverage.city'), data.options.cities)}
                {filterField('district', t('coverage.district'), data.options.districts)}
                {filterField('mosque', t('coverage.mosque'), data.options.mosques)}
              </>
            }
            exportData={{
              filename: `halaqat-coverage-${data.date}`,
              title: t('coverage.reportTitle'),
              meta: `${formatShortDate(data.date)} · ${
                values.city === 'all' ? t('common.all') : values.city
              }`,
              columns: exportColumns(columns),
              rows: exportRows,
            }}
          >
            <div className="grid grid-3 stagger">
              <Stat label={t('coverage.gapsStat')} value={formatNumber(data.gaps)} icon="!" />
              <Stat label={t('coverage.coveredStat')} value={formatNumber(data.covered)} icon="✓" />
              <Stat
                label={t('coverage.circlesStat')}
                value={formatNumber(data.rows.length)}
                icon="🕌"
              />
            </div>

            <Card>
              <Table
                columns={columns}
                rows={data.rows}
                getRowKey={(row) => row.circleId}
                caption={t('coverage.reportTitle')}
              />
            </Card>
          </ReportShell>
        ) : null}
      </DataState>
    </>
  );
}
