import { useCallback, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import * as adminService from '../../services/adminService.js';
import * as managementService from '../../services/managementService.js';
import { CITY_LIST, DISTRICT_LIST, MOSQUE_LIST } from '../../mock/db.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  SearchInput,
  Table,
  Pagination,
  Badge,
  Button,
  Modal,
  ConfirmDialog,
  Field,
  Input,
  Select,
  DataState,
  Skeleton,
} from '../../components/ui/index.js';

const EMPTY_CIRCLE = {
  name: '',
  city: '',
  district: '',
  mosque: '',
  level: 'beginner',
  schedule: 'الأحد – الخميس · بعد المغرب',
  teacherId: '',
  supervisorId: '',
};

/**
 * حلقات المنصة — إنشاءً وتعيينًا وحذفًا.
 *
 * الحلقة هنا كيانٌ يُبنى لا سجلٌّ يُتصفَّح: تُنشأ باسمها وموقعها، ويُسنَد
 * إليها معلّمها ومشرفها، ويُلغى الإسناد حين يلزم. وخانةٌ فارغة حالةٌ
 * مشروعة تظهر عند المشرف في «تغطية اليوم» بلا تغطية — وهذا هو المقصود.
 */
export default function AdminCircles() {
  const t = useT();
  const { role, user } = useAuth();
  const toast = useToast();
  const { values, setValue } = useListState({ defaults: { q: '', page: 1 } });
  const debouncedQuery = useDebouncedValue(values.q, 300);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CIRCLE);
  const [assigning, setAssigning] = useState(null);
  const [assignee, setAssignee] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [status, setStatus] = useState('idle');

  const fetcher = useCallback(
    () => adminService.getCircles({ query: debouncedQuery, page: values.page, perPage: 8 }),
    [debouncedQuery, values.page],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [debouncedQuery, values.page]);

  const teachersFetcher = useCallback(
    () => managementService.listAssignable({ role, slot: 'teacher' }),
    [role],
  );
  const { data: teachers } = useAsyncData(teachersFetcher, [role]);

  const supervisorsFetcher = useCallback(
    () => managementService.listAssignable({ role, slot: 'supervisor' }),
    [role],
  );
  const { data: supervisors } = useAsyncData(supervisorsFetcher, [role]);

  const run = async (action, successKey) => {
    setStatus('loading');
    try {
      await action();
      toast.success(t(successKey));
      await refetch();
      return true;
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
      return false;
    } finally {
      setStatus('idle');
    }
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    if (form.name.trim().length < 3) return;
    const ok = await run(
      () =>
        managementService.createCircle({
          role,
          actorId: user.userId,
          payload: {
            ...form,
            teacherId: form.teacherId || null,
            supervisorId: form.supervisorId || null,
          },
        }),
      'circles.created',
    );
    if (ok) {
      setCreateOpen(false);
      setForm(EMPTY_CIRCLE);
    }
  };

  const submitAssign = async () => {
    const ok = await run(
      () =>
        managementService.assignCircleRole({
          role,
          actorId: user.userId,
          circleId: assigning.row.id,
          slot: assigning.slot,
          userId: assignee || null,
        }),
      assignee ? 'circles.assigned' : 'circles.unassigned',
    );
    if (ok) {
      setAssigning(null);
      setAssignee('');
    }
  };

  const openAssign = (row, slot) => {
    setAssigning({ row, slot });
    setAssignee(slot === 'teacher' ? (row.teacherId ?? '') : (row.supervisorId ?? ''));
  };

  const candidates = assigning?.slot === 'teacher' ? (teachers ?? []) : (supervisors ?? []);

  const columns = [
    { key: 'name', header: t('circles.name') },
    {
      key: 'teacherName',
      header: t('circles.teacher'),
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          data-testid={`assign-teacher-${row.id}`}
          onClick={() => openAssign(row, 'teacher')}
        >
          {row.teacherName || t('circles.unassignedSlot')}
        </Button>
      ),
    },
    {
      key: 'supervisorName',
      header: t('circles.supervisor'),
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          data-testid={`assign-supervisor-${row.id}`}
          onClick={() => openAssign(row, 'supervisor')}
        >
          {row.supervisorName || t('circles.unassignedSlot')}
        </Button>
      ),
    },
    {
      key: 'location',
      header: t('admin.form.city'),
      render: (row) => [row.city, row.district].filter(Boolean).join(' · ') || '—',
    },
    {
      key: 'level',
      header: t('circles.level'),
      render: (row) => <Badge variant="neutral">{t(`circles.levels.${row.level}`)}</Badge>,
    },
    {
      key: 'studentsCount',
      header: t('circles.students'),
      render: (row) => formatNumber(row.studentsCount),
    },
    {
      key: 'performance',
      header: t('reports.performance'),
      render: (row) => (
        <Badge
          variant={row.performance >= 85 ? 'success' : row.performance >= 70 ? 'info' : 'warning'}
        >
          {formatPercent(row.performance)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('teacher.tableActions'),
      render: (row) => (
        <div className="table__actions">
          <Button size="sm" variant="secondary" to={`/app/admin/circles/${row.id}`}>
            {t('circles.open')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="t-danger"
            data-testid={`delete-circle-${row.id}`}
            onClick={() => setDeleting(row)}
          >
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('circles.title')}
        subtitle={t('circles.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/admin' }, { label: t('nav.circles') }]}
        actions={
          <Button onClick={() => setCreateOpen(true)} data-testid="create-circle">
            {t('circles.create')}
          </Button>
        }
      />

      <SearchInput
        value={values.q}
        onChange={(value) => setValue('q', value)}
        placeholder={t('common.searchPlaceholder')}
        label={t('search.label')}
      />

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
              caption={t('circles.title')}
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

      {/* إنشاء حلقة: اسمها وموقعها، ومن يقودها ومن يشرف عليها */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('circles.create')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="create-circle-form" status={status} data-testid="submit-circle">
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="create-circle-form" className="stack-4" onSubmit={submitCreate} noValidate>
          <Field label={t('circles.name')} required>
            <Input
              value={form.name}
              data-testid="circle-name"
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </Field>

          <div className="grid grid-2 stagger">
            <Field label={t('admin.form.city')}>
              <Select
                value={form.city}
                data-testid="circle-city"
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              >
                <option value="">—</option>
                {CITY_LIST.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('admin.form.district')}>
              <Select
                value={form.district}
                onChange={(event) => setForm((prev) => ({ ...prev, district: event.target.value }))}
              >
                <option value="">—</option>
                {DISTRICT_LIST.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('admin.form.mosque')}>
              <Select
                value={form.mosque}
                onChange={(event) => setForm((prev) => ({ ...prev, mosque: event.target.value }))}
              >
                <option value="">—</option>
                {MOSQUE_LIST.map((mosque) => (
                  <option key={mosque} value={mosque}>
                    {mosque}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('circles.level')}>
              <Select
                value={form.level}
                onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}
              >
                {['beginner', 'intermediate', 'advanced'].map((level) => (
                  <option key={level} value={level}>
                    {t(`circles.levels.${level}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-2 stagger">
            <Field label={t('circles.teacher')} optional hint={t('circles.assignLater')}>
              <Select
                value={form.teacherId}
                data-testid="circle-teacher"
                onChange={(event) => setForm((prev) => ({ ...prev, teacherId: event.target.value }))}
              >
                <option value="">{t('circles.unassignedSlot')}</option>
                {(teachers ?? []).map((candidate) => (
                  <option key={candidate.id} value={candidate.id} disabled={candidate.busy}>
                    {candidate.name}
                    {candidate.busy ? ` (${candidate.circleName})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('circles.supervisor')} optional hint={t('circles.assignLater')}>
              <Select
                value={form.supervisorId}
                data-testid="circle-supervisor"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, supervisorId: event.target.value }))
                }
              >
                <option value="">{t('circles.unassignedSlot')}</option>
                {(supervisors ?? []).map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </form>
      </Modal>

      {/* التعيين وإلغاؤه: فعلٌ واحد بقيمتين */}
      <Modal
        open={Boolean(assigning)}
        onClose={() => setAssigning(null)}
        title={t(assigning?.slot === 'teacher' ? 'circles.assignTeacher' : 'circles.assignSupervisor', {
          circle: assigning?.row?.name ?? '',
        })}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssigning(null)}>
              {t('common.cancel')}
            </Button>
            <Button status={status} onClick={submitAssign} data-testid="submit-assign">
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Field label={t('circles.assignee')} hint={t('circles.unassignHint')}>
          <Select
            value={assignee}
            data-testid="assignee-select"
            onChange={(event) => setAssignee(event.target.value)}
          >
            <option value="">{t('circles.unassignedSlot')}</option>
            {candidates.map((candidate) => (
              <option
                key={candidate.id}
                value={candidate.id}
                disabled={candidate.busy && candidate.id !== assignee}
              >
                {candidate.name}
                {candidate.busy ? ` (${candidate.circleName})` : ''}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const ok = await run(
            () => managementService.deleteCircle({ role, circleId: deleting.id }),
            'circles.deleted',
          );
          if (ok) setDeleting(null);
        }}
        title={t('circles.deleteTitle')}
        message={t('circles.deleteConfirm', { name: deleting?.name ?? '' })}
        variant="danger"
        status={status}
      />
    </>
  );
}
