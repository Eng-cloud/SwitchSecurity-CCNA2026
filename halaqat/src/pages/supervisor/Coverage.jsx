import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as coverageService from '../../services/coverageService.js';
import { formatNumber } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Stat,
  Badge,
  Button,
  Table,
  Field,
  Select,
  Alert,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';

const STATE_VARIANT = {
  onSite: 'success',
  deputized: 'info',
  pending: 'warning',
  needsCover: 'danger',
  escalated: 'danger',
};

/**
 * تغطية اليوم — الشاشة التي يبدأ منها المشرف صباحه.
 *
 * ترتيب الجدول ليس أبجديًا بل بالإلحاح: ما فقد معلّمه أولًا، ثم ما ينتظر
 * ردًّا، ثم ما استقرّ. والمشرف يتصرّف من السطر نفسه — يتولّى الحلقة بنفسه
 * أو يدخلها ليعيّن بديلًا — فلا يقرأ مشكلةً في شاشة ويعالجها في أخرى.
 */
export default function SupervisorCoverage() {
  const t = useT();
  const { role, user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
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

  const claim = async (row) => {
    setBusy(row.circleId);
    try {
      await coverageService.claimCoverage({
        role,
        userId: user?.userId,
        userName: user?.name,
        circleId: row.circleId,
      });
      toast.success(t('coverage.claimed'));
      await refetch();
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
    } finally {
      setBusy(null);
    }
  };

  const columns = [
    {
      key: 'circleName',
      header: t('nav.circle'),
      render: (row) => (
        <Link to={`/app/${role}/circles/${row.circleId}`}>{row.circleName}</Link>
      ),
    },
    {
      key: 'location',
      header: t('coverage.location'),
      render: (row) => [row.city, row.district, row.mosque].filter(Boolean).join(' · ') || '—',
    },
    {
      key: 'teacher',
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
      key: 'deputy',
      header: t('coverage.deputy'),
      // من اعتذر ليس نائبًا: عرض اسمه هنا يوهم بتغطيةٍ غير قائمة.
      render: (row) =>
        row.state === 'pending' || row.state === 'deputized' ? row.deputation.deputyName : '—',
    },
    {
      key: 'actions',
      header: t('teacher.tableActions'),
      render: (row) => (
        <div className="table__actions">
          <Button size="sm" variant="secondary" to={`/app/${role}/circles/${row.circleId}`}>
            {t('supervisor.openCircle')}
          </Button>
          {row.needsSupervisor ? (
            <Button
              size="sm"
              status={busy === row.circleId ? 'loading' : 'idle'}
              data-testid={`claim-${row.circleId}`}
              onClick={() => claim(row)}
            >
              {t('coverage.claim')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('coverage.pageTitle')}
        subtitle={t('coverage.pageSubtitle')}
        breadcrumb={[
          { label: t('nav.home'), to: `/app/${role}` },
          { label: t('coverage.pageTitle') },
        ]}
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={data?.rows?.length === 0}
        emptyTitle={t('coverage.emptyTitle')}
        emptyText={t('coverage.emptyText')}
        loadingFallback={<PageSkeleton />}
      >
        {data ? (
          <div className="stack-6">
            {/* التغطية تُقرأ جغرافيًّا: المشرف يتحرّك بين أحياء لا بين أسماء */}
            <Card className="row row-4 row-wrap">
              <Field label={t('coverage.city')} className="grow">
                <Select
                  value={values.city}
                  data-testid="coverage-city"
                  onChange={(event) => setValue('city', event.target.value)}
                >
                  <option value="all">{t('common.all')}</option>
                  {data.options.cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('coverage.district')} className="grow">
                <Select
                  value={values.district}
                  data-testid="coverage-district"
                  onChange={(event) => setValue('district', event.target.value)}
                >
                  <option value="all">{t('common.all')}</option>
                  {data.options.districts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('coverage.mosque')} className="grow">
                <Select
                  value={values.mosque}
                  data-testid="coverage-mosque"
                  onChange={(event) => setValue('mosque', event.target.value)}
                >
                  <option value="all">{t('common.all')}</option>
                  {data.options.mosques.map((mosque) => (
                    <option key={mosque} value={mosque}>
                      {mosque}
                    </option>
                  ))}
                </Select>
              </Field>
            </Card>

            {data.gaps > 0 ? (
              <Alert variant="danger" title={t('coverage.gapsTitle', { count: data.gaps })}>
                {t('coverage.gapsHint')}
              </Alert>
            ) : null}

            <div className="grid grid-3 stagger">
              <Stat label={t('coverage.gapsStat')} value={formatNumber(data.gaps)} icon="!" />
              <Stat
                label={t('coverage.coveredStat')}
                value={formatNumber(data.covered)}
                icon="✓"
              />
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
                caption={t('coverage.pageTitle')}
              />
            </Card>
          </div>
        ) : null}
      </DataState>
    </>
  );
}
