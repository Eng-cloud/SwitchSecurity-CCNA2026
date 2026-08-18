import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import * as teacherService from '../../services/teacherService.js';
import { formatNumber, formatPercent, formatRelative } from '../../lib/format.js';
import {
  PageHeader,
  Table,
  Pagination,
  SearchInput,
  Select,
  Field,
  Button,
  Badge,
  DataState,
  Skeleton,
  Card,
} from '../../components/ui/index.js';
import AddNoteModal from '../../components/teacher/AddNoteModal.jsx';

const STATUS_VARIANT = {
  excellent: 'success',
  onTrack: 'info',
  behind: 'warning',
  atRisk: 'danger',
};

const ATTENDANCE_VARIANT = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'info',
};

/**
 * جدول الحلقة — الحالة والحضور والإجراءات.
 * تُحفظ حالة البحث/الصفحة في عنوان الصفحة فيعود المستخدم لنفس الحالة عند الرجوع.
 */
export default function TeacherCircle() {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();
  const [noteFor, setNoteFor] = useState(null);
  const [sort, setSort] = useState(null);

  const { values, setValue } = useListState({
    defaults: { q: '', status: 'all', page: 1 },
  });
  const debouncedQuery = useDebouncedValue(values.q, 300);

  const fetcher = useCallback(
    () =>
      teacherService.getCircleStudents(user.circleId, {
        query: debouncedQuery,
        status: values.status,
        page: values.page,
        perPage: 8,
        sort,
      }),
    [user.circleId, debouncedQuery, values.status, values.page, sort],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [
    user.circleId,
    debouncedQuery,
    values.status,
    values.page,
    sort,
  ]);

  const handleAttendance = async (studentId, status) => {
    try {
      await teacherService.setAttendance(studentId, status);
      toast.success(t('teacher.attendanceSaved'));
      refetch();
    } catch {
      toast.error(t('state.errorHint'));
    }
  };

  const columns = [
    {
      key: 'name',
      header: t('teacher.tableStudent'),
      sortable: true,
      render: (row) => (
        <span className="table__name">
          {/* Link لا <a>: الوسم العادي يخرج من التطبيق ويكسر نسخة الملف الواحد. */}
          <Link to={`/app/teacher/students/${row.id}`}>{row.name}</Link>
          {row.isAssistant ? (
            <Badge variant="success" icon="★">
              {t('teacher.assistant.badge')}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: 'attendanceToday',
      header: t('teacher.tableAttendance'),
      render: (row) => (
        <Badge variant={ATTENDANCE_VARIANT[row.attendanceToday]}>
          {t(`teacher.attendanceStatus.${row.attendanceToday}`)}
        </Badge>
      ),
    },
    {
      key: 'memorizedPages',
      header: t('teacher.tableMemorization'),
      sortable: true,
      render: (row) => <span className="tnum">{formatNumber(row.memorizedPages)}</span>,
    },
    {
      key: 'reviewRate',
      header: t('teacher.tableReview'),
      sortable: true,
      render: (row) => <span className="tnum">{formatPercent(row.reviewRate)}</span>,
    },
    {
      key: 'lastRecitationAt',
      header: t('teacher.tableLastRecitation'),
      render: (row) => <span className="t-sm">{formatRelative(row.lastRecitationAt, t)}</span>,
    },
    {
      key: 'status',
      header: t('teacher.tableStatus'),
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status]}>{t(`teacher.status.${row.status}`)}</Badge>
      ),
    },
    {
      key: 'actions',
      header: t('teacher.tableActions'),
      render: (row) => (
        <div className="table__actions">
          <Button size="sm" variant="secondary" to={`/app/teacher/students/${row.id}`}>
            {t('teacher.viewStudent')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleAttendance(row.id, 'present')}
            disabled={row.attendanceToday === 'present'}
          >
            {t('teacher.markAttendance')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNoteFor(row)}>
            {t('teacher.addNote')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('nav.circle')}
        subtitle={t('teacher.dashboardTitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/teacher' }, { label: t('nav.circle') }]}
        actions={
          <>
            <Button variant="ghost" to="/app/teacher/assistant">
              {t('teacher.assistant.title')}
            </Button>
            <Button variant="secondary" to="/app/teacher/reports">
              {t('teacher.openReport')}
            </Button>
          </>
        }
      />

      <Card variant="quiet" className="row row-4 row-wrap">
        <div className="grow" style={{ minWidth: '240px' }}>
          <SearchInput
            value={values.q}
            onChange={(value) => setValue('q', value)}
            placeholder={t('common.searchPlaceholder')}
            label={t('search.label')}
          />
        </div>
        <Field label={t('teacher.tableStatus')} className="shrink-0">
          <Select value={values.status} onChange={(event) => setValue('status', event.target.value)}>
            <option value="all">{t('common.all')}</option>
            {Object.keys(STATUS_VARIANT).map((status) => (
              <option key={status} value={status}>
                {t(`teacher.status.${status}`)}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={data?.items?.length === 0}
        emptyTitle={t('state.emptySearchTitle')}
        emptyText={t('state.emptySearchHint')}
        loadingFallback={<Skeleton variant="card" count={5} height={56} />}
      >
        {data ? (
          <>
            <Table
              columns={columns}
              rows={data.items}
              getRowKey={(row) => row.id}
              caption={t('nav.circle')}
              sort={sort}
              onSortChange={setSort}
            />
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              from={data.from}
              to={data.to}
              onChange={(page) => setValue('page', page, { resetPage: false })}
            />
          </>
        ) : null}
      </DataState>

      <AddNoteModal
        open={Boolean(noteFor)}
        student={noteFor}
        onClose={() => setNoteFor(null)}
        onSaved={refetch}
      />
    </>
  );
}
