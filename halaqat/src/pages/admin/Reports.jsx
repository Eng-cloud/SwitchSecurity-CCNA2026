import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as adminService from '../../services/adminService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Button,
  Stat,
  Card,
  Table,
  Field,
  Select,
  SegmentedControl,
  BarChart,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';
import ReportShell from '../../components/reports/ReportShell.jsx';
import { exportColumns } from '../../lib/export.js';

/**
 * تقرير الإدارة بنطاقين.
 *
 * «حسب المدن» تقريرٌ عام يُقارَن به بين المدن، و«حسب الحلقات» تقريرٌ خاص
 * يُتابَع به حلقةٌ بعينها. وهما سؤالان مختلفان لا عرضان لسؤال واحد،
 * فلكلٍّ أعمدته: المدينة تُقاس بعدد حلقاتها، والحلقة بمعلّمها ومشرفها.
 */
export default function AdminReports() {
  const t = useT();
  const { user } = useAuth();
  const { values, setValue } = useListState({
    defaults: { period: 'monthly', scope: 'circles', city: 'all' },
  });

  const fetcher = useCallback(
    () =>
      adminService.getAdminReport({
        period: values.period,
        scope: values.scope,
        city: values.city,
      }),
    [values.period, values.scope, values.city],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [
    values.period,
    values.scope,
    values.city,
  ]);

  const byCity = values.scope === 'cities';

  const columns = byCity
    ? [
        { key: 'name', header: t('coverage.city') },
        {
          key: 'circlesCount',
          header: t('nav.circles'),
          render: (row) => formatNumber(row.circlesCount),
        },
        {
          key: 'studentsCount',
          header: t('circles.students'),
          render: (row) => formatNumber(row.studentsCount),
        },
        {
          key: 'attendanceRate',
          header: t('reports.attendanceRate'),
          render: (row) => formatPercent(row.attendanceRate),
        },
        {
          key: 'performance',
          header: t('reports.performance'),
          render: (row) => formatPercent(row.performance),
        },
        {
          key: 'testsAverage',
          header: t('reports.testsAverage'),
          render: (row) => formatPercent(row.testsAverage),
        },
      ]
    : [
        { key: 'name', header: t('circles.name') },
        { key: 'city', header: t('coverage.city') },
        { key: 'teacherName', header: t('circles.teacher') },
        { key: 'supervisorName', header: t('circles.supervisor') },
        {
          key: 'studentsCount',
          header: t('circles.students'),
          render: (row) => formatNumber(row.studentsCount),
        },
        {
          key: 'attendanceRate',
          header: t('reports.attendanceRate'),
          render: (row) => formatPercent(row.attendanceRate),
        },
        {
          key: 'performance',
          header: t('reports.performance'),
          render: (row) => formatPercent(row.performance),
        },
        {
          key: 'testsAverage',
          header: t('reports.testsAverage'),
          render: (row) => formatPercent(row.testsAverage),
        },
      ];

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('admin.dashboardTitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/admin' }, { label: t('reports.title') }]}
        actions={
          <Button variant="secondary" to="/app/admin/reports/teachers">
            {t('teacherAttendance.title')}
          </Button>
        }
      />

      <ReportShell
        title={t('admin.dashboardTitle')}
        period={values.period}
        onPeriodChange={(period) => setValue('period', period)}
        preparedBy={user.name}
        filters={
          <>
            <div className="stack-2">
              <span className="field__label">{t('reports.scope')}</span>
              <SegmentedControl
                label={t('reports.scope')}
                value={values.scope}
                onChange={(scope) => setValue('scope', scope)}
                options={[
                  { value: 'circles', label: t('reports.scopeCircles') },
                  { value: 'cities', label: t('reports.scopeCities') },
                ]}
              />
            </div>
            <Field label={t('coverage.city')}>
              <Select
                value={values.city}
                data-testid="report-city"
                onChange={(event) => setValue('city', event.target.value)}
              >
                <option value="all">{t('common.all')}</option>
                {(data?.cities ?? []).map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        }
        exportData={{
          filename: `halaqat-admin-${values.scope}-${values.period}`,
          title: t(byCity ? 'reports.scopeCities' : 'reports.scopeCircles'),
          meta: `${t(`reports.${values.period}`)} · ${
            values.city === 'all' ? t('common.all') : values.city
          }`,
          columns: exportColumns(columns),
          rows: data?.rows ?? [],
        }}
      >
        <DataState
          loading={loading}
          error={error}
          onRetry={refetch}
          isEmpty={false}
          loadingFallback={<PageSkeleton />}
        >
          {data ? (
            <div className="stack-6">
              <div className="grid grid-4 stagger">
                <Stat
                  label={t('admin.totalCircles')}
                  value={formatNumber(data.totals.circles)}
                  icon="🕌"
                />
                <Stat
                  label={t('admin.totalStudents')}
                  value={formatNumber(data.totals.students)}
                  icon="🧑‍🎓"
                />
                <Stat
                  label={t('admin.totalTeachers')}
                  value={formatNumber(data.totals.teachers)}
                  icon="🧑‍🏫"
                />
                <Stat
                  label={t('reports.performance')}
                  value={formatPercent(data.totals.performance)}
                  icon="📈"
                />
              </div>

              <Card>
                <BarChart
                  title={t('reports.trend')}
                  data={data.series}
                  series={[
                    { key: 'memorization', label: t('reports.memorization') },
                    { key: 'review', label: t('reports.review') },
                    { key: 'tests', label: t('reports.tests') },
                  ]}
                />
              </Card>

              <Table
                columns={columns}
                rows={data.rows}
                getRowKey={(row) => row.id}
                caption={t('reports.title')}
                emptyMessage={t('reports.noData')}
              />
            </div>
          ) : null}
        </DataState>
      </ReportShell>
    </>
  );
}
