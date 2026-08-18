import { useCallback, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import * as managementService from '../../services/managementService.js';
import { CITY_LIST } from '../../mock/db.js';
import { ROLE_HOME } from '../../config/navigation.js';
import { can, ACTIONS } from '../../config/permissions.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  SearchInput,
  Select,
  Field,
  Input,
  Card,
  Button,
  Badge,
  Avatar,
  Pagination,
  Modal,
  ConfirmDialog,
  DataState,
  Skeleton,
} from '../../components/ui/index.js';
import UserFormModal from '../../components/management/UserFormModal.jsx';

/**
 * قسم المعلمين — يخدم الإدارة والمشرف:
 * إضافة وحذف معلم، وعرض طلابه مع إضافة/حذف طالب وتعيين مساعد.
 */
export default function AdminTeachers() {
  const t = useT();
  const { role, user } = useAuth();
  const toast = useToast();
  const { values, setValue } = useListState({ defaults: { q: '', city: 'all', page: 1 } });
  const debouncedQuery = useDebouncedValue(values.q, 300);

  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [addStudentFor, setAddStudentFor] = useState(null);
  const [removingStudent, setRemovingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState({ name: '', age: '', guardianName: '' });
  const [status, setStatus] = useState('idle');

  const canAssignAssistant = can(role, ACTIONS.ASSISTANT_ASSIGN);
  const isSupervisor = role === 'supervisor';

  const fetcher = useCallback(
    () =>
      managementService.listTeachers({
        role,
        userId: user.userId,
        query: debouncedQuery,
        city: values.city,
        page: values.page,
        perPage: 6,
      }),
    [role, user.userId, debouncedQuery, values.city, values.page],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [
    role,
    debouncedQuery,
    values.city,
    values.page,
  ]);

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

  const handleCreate = async (payload) => {
    const ok = await run(
      () =>
        managementService.createUser({
          role,
          actorId: user.userId,
          payload: { ...payload, supervisorId: isSupervisor ? user.userId : payload.supervisorId },
        }),
      'admin.teachers.created',
    );
    if (ok) setAddOpen(false);
  };

  const handleAddStudent = async (event) => {
    event.preventDefault();
    if (studentForm.name.trim().length < 3) return;
    const ok = await run(
      () =>
        managementService.addStudent({
          role,
          payload: { ...studentForm, circleId: addStudentFor.circleId },
        }),
      'admin.teachers.studentAdded',
    );
    if (ok) {
      setAddStudentFor(null);
      setStudentForm({ name: '', age: '', guardianName: '' });
    }
  };

  return (
    <>
      <PageHeader
        title={t('admin.teachers.title')}
        subtitle={t('admin.teachers.subtitle')}
        breadcrumb={[
          { label: t('nav.home'), to: ROLE_HOME[role] ?? '/app' },
          { label: t('nav.teachers') },
        ]}
        actions={
          <Button onClick={() => setAddOpen(true)} data-testid="add-teacher">
            {t('admin.teachers.add')}
          </Button>
        }
      />

      <Card variant="quiet" className="row row-4 row-wrap">
        <div className="grow" style={{ minWidth: '220px' }}>
          <SearchInput
            value={values.q}
            onChange={(value) => setValue('q', value)}
            placeholder={t('common.searchPlaceholder')}
            label={t('search.label')}
          />
        </div>
        <Field label={t('admin.form.city')}>
          <Select value={values.city} onChange={(event) => setValue('city', event.target.value)}>
            <option value="all">{t('common.all')}</option>
            {CITY_LIST.map((city) => (
              <option key={city} value={city}>
                {city}
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
        loadingFallback={<Skeleton variant="card" count={4} height={130} />}
      >
        {data ? (
          <>
            <ul className="stack-3">
              {data.items.map((teacher) => (
                <li key={teacher.id}>
                  <Card className="stack-4">
                    <div className="row row-4 row-wrap">
                      <Avatar name={teacher.name} size="lg" />
                      <div className="grow">
                        <p className="t-lg t-semibold">{teacher.name}</p>
                        <p className="t-xs t-muted">
                          {teacher.city} · {teacher.district}
                          {teacher.mosque ? ` · ${teacher.mosque}` : ''}
                        </p>
                        <p className="t-xs t-muted">{teacher.circleName || '—'}</p>
                      </div>

                      <div className="row row-3 row-wrap">
                        <Badge variant="brand">
                          {t('circles.students')}: {formatNumber(teacher.studentsCount)}
                        </Badge>
                        {teacher.assistantsCount > 0 ? (
                          <Badge variant="success" icon="★">
                            {t('teacher.assistant.badge')}: {formatNumber(teacher.assistantsCount)}
                          </Badge>
                        ) : null}
                        <Badge variant="neutral">
                          {t('reports.performance')}: {formatPercent(teacher.performance)}
                        </Badge>
                      </div>
                    </div>

                    <div className="row row-3 row-wrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setExpanded(expanded === teacher.id ? null : teacher.id)}
                        aria-expanded={expanded === teacher.id}
                        data-testid="toggle-students"
                      >
                        {expanded === teacher.id
                          ? t('admin.teachers.hideStudents')
                          : t('admin.teachers.viewStudents')}
                      </Button>

                      {teacher.circleId ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setAddStudentFor(teacher)}
                          data-testid="add-student"
                        >
                          {t('admin.teachers.addStudent')}
                        </Button>
                      ) : null}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="t-danger"
                        onClick={() => setDeleting(teacher)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>

                    {expanded === teacher.id ? (
                      teacher.students.length === 0 ? (
                        <p className="t-sm t-muted">{t('admin.teachers.noStudents')}</p>
                      ) : (
                        <ul className="stack-2">
                          {teacher.students.map((student) => (
                            <li key={student.id}>
                              <Card variant="quiet" className="row row-3 row-wrap">
                                <div className="grow">
                                  <p className="t-medium">
                                    {student.name}
                                    {student.isAssistant ? (
                                      <Badge variant="success" icon="★" className="mt-2">
                                        {t('teacher.assistant.badge')}
                                      </Badge>
                                    ) : null}
                                  </p>
                                  <p className="t-xs t-muted">
                                    {t('reports.averageMastery')}: {formatPercent(student.masteryAvg)} ·{' '}
                                    {t('reports.attendanceRate')}: {formatPercent(student.attendanceRate)}
                                  </p>
                                </div>

                                {canAssignAssistant ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      run(
                                        () =>
                                          managementService.setAssistant({
                                            role,
                                            studentId: student.id,
                                            isAssistant: !student.isAssistant,
                                          }),
                                        student.isAssistant
                                          ? 'teacher.assistant.unassigned'
                                          : 'teacher.assistant.assigned',
                                      )
                                    }
                                  >
                                    {student.isAssistant
                                      ? t('teacher.assistant.unassign')
                                      : t('teacher.assistant.assign')}
                                  </Button>
                                ) : null}

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="t-danger"
                                  onClick={() => setRemovingStudent(student)}
                                >
                                  {t('admin.teachers.removeStudent')}
                                </Button>
                              </Card>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>

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

      <UserFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
        targetRole="teacher"
        status={status}
      />

      {/* إضافة طالب إلى حلقة المعلم */}
      <Modal
        open={Boolean(addStudentFor)}
        onClose={() => setAddStudentFor(null)}
        title={t('admin.teachers.addStudentTitle', { circle: addStudentFor?.circleName ?? '' })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddStudentFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddStudent} status={status} data-testid="submit-student">
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form className="stack-4" onSubmit={handleAddStudent} noValidate>
          <Field label={t('admin.form.name')} required>
            <Input
              value={studentForm.name}
              onChange={(event) => setStudentForm((prev) => ({ ...prev, name: event.target.value }))}
              data-testid="student-name"
            />
          </Field>
          <div className="grid grid-2 stagger">
            <Field label={t('admin.form.age')} optional>
              <Input
                type="number"
                min="6"
                max="20"
                value={studentForm.age}
                onChange={(event) => setStudentForm((prev) => ({ ...prev, age: event.target.value }))}
              />
            </Field>
            <Field label={t('admin.form.guardianName')} optional>
              <Input
                value={studentForm.guardianName}
                onChange={(event) =>
                  setStudentForm((prev) => ({ ...prev, guardianName: event.target.value }))
                }
              />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const ok = await run(
            () => managementService.deleteUser({ role, userId: deleting.id }),
            'admin.teachers.deleted',
          );
          if (ok) setDeleting(null);
        }}
        title={t('admin.users.deleteTitle', { name: deleting?.name ?? '' })}
        message={t('admin.users.deleteConfirm')}
        confirmLabel={t('common.delete')}
        variant="danger"
        status={status}
      />

      <ConfirmDialog
        open={Boolean(removingStudent)}
        onClose={() => setRemovingStudent(null)}
        onConfirm={async () => {
          const ok = await run(
            () => managementService.removeStudent({ role, studentId: removingStudent.id }),
            'admin.teachers.studentRemoved',
          );
          if (ok) setRemovingStudent(null);
        }}
        title={t('admin.teachers.removeStudent')}
        message={t('admin.teachers.removeStudentConfirm')}
        confirmLabel={t('common.delete')}
        variant="danger"
        status={status}
      />
    </>
  );
}
