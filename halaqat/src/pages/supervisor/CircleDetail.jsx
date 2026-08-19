import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useGoBack from '../../hooks/useGoBack.js';
import useAttendance from '../../hooks/useAttendance.js';
import SectionBoundary from '../../components/system/SectionBoundary.jsx';
import AttendanceSelect from '../../components/attendance/AttendanceSelect.jsx';
import CoveragePanel from '../../components/coverage/CoveragePanel.jsx';
import * as supervisorService from '../../services/supervisorService.js';
import * as managementService from '../../services/managementService.js';
import { can, ACTIONS } from '../../config/permissions.js';
import { formatNumber, formatPercent, formatShortDate, formatSchedule } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Stat,
  Table,
  Badge,
  Button,
  Avatar,
  BarChart,
  Modal,
  ConfirmDialog,
  Field,
  Input,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';

const EMPTY_STUDENT = { name: '', age: '', guardianName: '' };

/**
 * تفاصيل الحلقة — للمشرف والإدارة بنفس الصفحة.
 *
 * لا تكتفي بالعرض: من يملك إدارة الطلاب يضيف ويحذف من هنا، ومن يملك إدارة
 * المعلمين يوقف معلم الحلقة أو يعيد تفعيله — دون مغادرة الحلقة إلى قسم آخر.
 * الأزرار تُبنى من مصفوفة الصلاحيات لا من الدور مباشرة.
 */
export default function CircleDetail() {
  const t = useT();
  const { circleId } = useParams();
  const { role } = useAuth();
  const toast = useToast();
  const goBack = useGoBack(`/app/${role}/circles`);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_STUDENT);
  const [removing, setRemoving] = useState(null);
  const [teacherAction, setTeacherAction] = useState(null);
  const [status, setStatus] = useState('idle');

  const fetcher = useCallback(() => supervisorService.getCircleDetail(circleId), [circleId]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [circleId]);

  const { pending, setAttendance } = useAttendance({ onSaved: refetch });

  const mayManageStudents = can(role, ACTIONS.STUDENTS_MANAGE);
  const mayRecordAttendance = can(role, ACTIONS.ATTENDANCE_RECORD);
  // تغطية اليوم عملٌ ميداني: من لا يديرها لا يرى لوحتها ولا أزرارها.
  const mayManageCoverage = can(role, ACTIONS.COVERAGE_MANAGE);
  const mayManageTeachers = can(role, ACTIONS.TEACHERS_MANAGE);

  /** ينفّذ إجراءً ويعرض نتيجته، ثم يحدّث الصفحة. */
  const run = async (action, successKey) => {
    setStatus('loading');
    try {
      await action();
      toast.success(t(successKey));
      refetch();
      return true;
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
      return false;
    } finally {
      setStatus('idle');
    }
  };

  const handleAddStudent = async (event) => {
    event.preventDefault();
    if (form.name.trim().length < 3) return;
    const ok = await run(
      () => managementService.addStudent({ role, payload: { ...form, circleId } }),
      'admin.teachers.studentAdded',
    );
    if (ok) {
      setAddOpen(false);
      setForm(EMPTY_STUDENT);
    }
  };

  const confirmRemove = async () => {
    const ok = await run(
      () => managementService.removeStudent({ role, studentId: removing.id }),
      'admin.teachers.studentRemoved',
    );
    if (ok) setRemoving(null);
  };

  /** إيقاف معلم الحلقة أو إعادة تفعيله. */
  const confirmTeacherAction = async () => {
    const next = teacherAction.next;
    const ok = await run(
      () => managementService.setUserStatus({ role, userId: data.teacher.id, status: next }),
      next === 'suspended' ? 'circleDetail.teacherSuspended' : 'circleDetail.teacherActivated',
    );
    if (ok) setTeacherAction(null);
  };

  const columns = [
    { key: 'name', header: t('teacher.tableStudent') },
    // المشرف مسؤول عن انعقاد الحلقة، فيملك تسجيل حضورها من داخلها.
    ...(mayRecordAttendance
      ? [
          {
            key: 'attendanceToday',
            header: t('teacher.tableAttendance'),
            render: (row) => (
              <AttendanceSelect
                data-testid={`attendance-${row.id}`}
                name={row.name}
                value={pending[row.id] ?? row.attendanceToday}
                busy={Boolean(pending[row.id])}
                onChange={(status) => setAttendance(row, status)}
              />
            ),
          },
        ]
      : []),
    {
      key: 'memorizedPages',
      header: t('reports.pagesMemorized'),
      render: (row) => formatNumber(row.memorizedPages),
    },
    {
      key: 'attendanceRate',
      header: t('reports.attendanceRate'),
      render: (row) => formatPercent(row.attendanceRate),
    },
    {
      key: 'status',
      header: t('teacher.tableStatus'),
      render: (row) => (
        <Badge
          variant={
            row.status === 'atRisk'
              ? 'danger'
              : row.status === 'behind'
                ? 'warning'
                : 'info'
          }
        >
          {t(`teacher.status.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('teacher.tableActions'),
      render: (row) => (
        <div className="table__actions">
          <Button size="sm" variant="secondary" to={`/app/${role}/students/${row.id}`}>
            {t('teacher.viewStudent')}
          </Button>
          {mayManageStudents ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRemoving(row)}
              data-testid="remove-student"
            >
              {t('admin.teachers.removeStudent')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const teacherSuspended = data?.teacher?.status === 'suspended';

  return (
    <>
      <PageHeader
        title={data?.name ?? t('nav.circle')}
        documentTitle={data?.name}
        subtitle={data ? [formatSchedule(data), data.location].filter(Boolean).join(' · ') : undefined}
        breadcrumb={[
          { label: t('nav.home'), to: `/app/${role}` },
          { label: t('nav.circles'), to: `/app/${role}/circles` },
          { label: data?.name ?? '' },
        ]}
        actions={
          <>
            <Button variant="ghost" onClick={goBack}>
              {t('common.back')}
            </Button>
            {mayManageStudents ? (
              <Button onClick={() => setAddOpen(true)} data-testid="add-student">
                {t('admin.teachers.addStudent')}
              </Button>
            ) : null}
          </>
        }
      />

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
                label={t('supervisor.tableStudents')}
                value={formatNumber(data.studentsCount)}
                icon="👥"
              />
              <Stat
                label={t('reports.attendanceRate')}
                value={formatPercent(data.attendanceRate)}
                icon="✓"
              />
              <Stat
                label={t('supervisor.tablePerformance')}
                value={formatPercent(data.performance)}
                icon="📈"
              />
              <Stat
                label={t('supervisor.needsAttention')}
                value={formatNumber(data.atRisk)}
                icon="!"
              />
            </div>

            {mayManageCoverage ? (
              <CoveragePanel circleId={circleId} onChange={refetch} />
            ) : null}

            {data.teacher ? (
              <Card className="row row-4 row-wrap">
                <Avatar name={data.teacher.name} size="lg" />
                <div className="grow">
                  <p className="t-sm t-muted">{t('supervisor.teacherProfile')}</p>
                  <p className="t-lg t-semibold">
                    {data.teacher.name}{' '}
                    {teacherSuspended ? (
                      <Badge variant="danger">{t('circleDetail.suspended')}</Badge>
                    ) : null}
                  </p>
                  <p className="t-xs t-muted" style={{ direction: 'ltr', textAlign: 'start' }}>
                    {data.teacher.email} · {data.teacher.phone}
                  </p>
                </div>

                <div className="stack-2">
                  <p className="t-sm t-muted">
                    {t('teacher.studentInfo.joined')}: {formatShortDate(data.teacher.joinedAt)}
                  </p>
                  {mayManageTeachers ? (
                    <Button
                      size="sm"
                      variant={teacherSuspended ? 'secondary' : 'ghost'}
                      onClick={() =>
                        setTeacherAction({ next: teacherSuspended ? 'active' : 'suspended' })
                      }
                      data-testid="toggle-teacher"
                    >
                      {teacherSuspended
                        ? t('circleDetail.activateTeacher')
                        : t('circleDetail.suspendTeacher')}
                    </Button>
                  ) : null}
                </div>
              </Card>
            ) : null}

            {/* الرسم معزول: عطبه لا يُخفي جدول الطلاب ولا إجراءات الحلقة. */}
            <SectionBoundary name="circle-chart">
              <Card>
                <BarChart
                  title={t('supervisor.circleOverview')}
                  data={data.series}
                  series={[
                    { key: 'memorization', label: t('reports.memorization') },
                    { key: 'review', label: t('reports.review') },
                  ]}
                />
              </Card>
            </SectionBoundary>

            <Table
              columns={columns}
              rows={data.students}
              getRowKey={(row) => row.id}
              caption={t('nav.students')}
            />
          </div>
        ) : null}
      </DataState>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('admin.teachers.addStudentTitle', { circle: data?.name ?? '' })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="add-student-form"
              status={status}
              data-testid="submit-student"
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="add-student-form" className="stack-4" onSubmit={handleAddStudent} noValidate>
          <Field label={t('admin.form.name')} required>
            <Input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              data-testid="student-name"
            />
          </Field>
          <div className="grid grid-2 stagger">
            <Field label={t('admin.form.age')} optional>
              <Input
                type="number"
                min="6"
                max="20"
                value={form.age}
                onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))}
              />
            </Field>
            <Field label={t('admin.form.guardianName')} optional>
              <Input
                value={form.guardianName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, guardianName: event.target.value }))
                }
              />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title={t('admin.teachers.removeStudent')}
        message={t('admin.teachers.removeStudentConfirm')}
        variant="danger"
        status={status}
      />

      <ConfirmDialog
        open={Boolean(teacherAction)}
        onClose={() => setTeacherAction(null)}
        onConfirm={confirmTeacherAction}
        title={
          teacherAction?.next === 'suspended'
            ? t('circleDetail.suspendTeacher')
            : t('circleDetail.activateTeacher')
        }
        message={
          teacherAction?.next === 'suspended'
            ? t('circleDetail.suspendConfirm')
            : t('circleDetail.activateConfirm')
        }
        variant={teacherAction?.next === 'suspended' ? 'danger' : 'primary'}
        status={status}
      />
    </>
  );
}
