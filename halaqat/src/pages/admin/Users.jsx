import { useCallback, useState } from 'react';
import { sortRoles } from '../../config/permissions.js';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import * as adminService from '../../services/adminService.js';
import * as managementService from '../../services/managementService.js';
import { formatShortDate } from '../../lib/format.js';
import {
  PageHeader,
  SearchInput,
  Select,
  Field,
  Card,
  Table,
  Pagination,
  Badge,
  Button,
  Modal,
  ConfirmDialog,
  Alert,
  RadioGroup,
  DataState,
  Skeleton,
} from '../../components/ui/index.js';
import UserFormModal from '../../components/management/UserFormModal.jsx';

/**
 * مستخدمو المنصة الإداريون: الإدارة والمشرفون والمعلمون.
 * الطلاب وأولياء الأمور يُدارون من قسم المعلمين ومن طلبات التسجيل،
 * فلا يختلط سجل المستخدمين بسجل الطلاب.
 */
const MANAGED_ROLES = sortRoles(['admin', 'supervisor', 'teacher']);

export default function AdminUsers() {
  const t = useT();
  const { role, user } = useAuth();
  const toast = useToast();
  const { values, setValue, resetAll, isFiltered } = useListState({
    defaults: { q: '', role: 'all', status: 'all', page: 1 },
  });
  const debouncedQuery = useDebouncedValue(values.q, 300);

  const [addOpen, setAddOpen] = useState(false);
  const [addRole, setAddRole] = useState('supervisor');
  const [roleChangeFor, setRoleChangeFor] = useState(null);
  const [nextRole, setNextRole] = useState('supervisor');
  const [deleting, setDeleting] = useState(null);
  const [status, setStatus] = useState('idle');

  const fetcher = useCallback(
    () =>
      adminService.getUsers({
        query: debouncedQuery,
        role: values.role,
        status: values.status,
        page: values.page,
        perPage: 10,
        roles: MANAGED_ROLES,
      }),
    [debouncedQuery, values.role, values.status, values.page],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [
    debouncedQuery,
    values.role,
    values.status,
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

  const columns = [
    { key: 'name', header: t('admin.tableName') },
    {
      key: 'role',
      header: t('admin.tableRole'),
      render: (row) => <Badge variant="neutral">{t(`roles.${row.role}`)}</Badge>,
    },
    {
      key: 'location',
      header: t('admin.form.city'),
      render: (row) => [row.city, row.district].filter(Boolean).join(' · ') || '—',
    },
    {
      key: 'circleName',
      header: t('admin.tableCircle'),
      render: (row) => row.circleName || '—',
    },
    {
      key: 'status',
      header: t('admin.tableStatus'),
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'neutral'}>
          {t(`admin.userStatus.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: 'joinedAt',
      header: t('admin.tableJoined'),
      render: (row) => formatShortDate(row.joinedAt),
    },
    {
      key: 'actions',
      header: t('teacher.tableActions'),
      render: (row) => (
        <div className="table__actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setRoleChangeFor(row);
              setNextRole(row.role);
            }}
          >
            {t('admin.users.changeRole')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              run(
                () =>
                  managementService.setUserStatus({
                    role,
                    userId: row.id,
                    status: row.status === 'active' ? 'inactive' : 'active',
                  }),
                'admin.users.statusChanged',
              )
            }
          >
            {row.status === 'active' ? t('admin.users.deactivate') : t('admin.users.activate')}
          </Button>
          {row.id !== user.userId ? (
            <Button size="sm" variant="ghost" className="t-danger" onClick={() => setDeleting(row)}>
              {t('common.delete')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('admin.users.title')}
        subtitle={t('admin.users.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/admin' }, { label: t('nav.users') }]}
        actions={
          <div className="row row-2">
            <Button
              variant="secondary"
              onClick={() => {
                setAddRole('supervisor');
                setAddOpen(true);
              }}
            >
              {t('admin.supervisors.add')}
            </Button>
            <Button
              onClick={() => {
                setAddRole('teacher');
                setAddOpen(true);
              }}
              data-testid="add-user"
            >
              {t('admin.teachers.add')}
            </Button>
          </div>
        }
      />

      <Alert variant="info">{t('admin.users.note')}</Alert>

      <Card variant="quiet" className="row row-4 row-wrap">
        <div className="grow" style={{ minWidth: '220px' }}>
          <SearchInput
            value={values.q}
            onChange={(value) => setValue('q', value)}
            placeholder={t('common.searchPlaceholder')}
            label={t('search.label')}
          />
        </div>

        <Field label={t('admin.tableRole')}>
          <Select value={values.role} onChange={(event) => setValue('role', event.target.value)}>
            <option value="all">{t('common.all')}</option>
            {MANAGED_ROLES.map((item) => (
              <option key={item} value={item}>
                {t(`roles.${item}`)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('admin.tableStatus')}>
          <Select value={values.status} onChange={(event) => setValue('status', event.target.value)}>
            <option value="all">{t('common.all')}</option>
            {['active', 'inactive'].map((item) => (
              <option key={item} value={item}>
                {t(`admin.userStatus.${item}`)}
              </option>
            ))}
          </Select>
        </Field>

        {isFiltered ? (
          <Button variant="ghost" onClick={resetAll}>
            {t('common.reset')}
          </Button>
        ) : null}
      </Card>

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={data?.items?.length === 0}
        emptyTitle={t('state.emptySearchTitle')}
        emptyText={t('state.emptySearchHint')}
        emptyAction={
          isFiltered ? (
            <Button variant="secondary" onClick={resetAll}>
              {t('common.reset')}
            </Button>
          ) : null
        }
        loadingFallback={<Skeleton variant="card" count={6} height={52} />}
      >
        {data ? (
          <>
            <Table
              columns={columns}
              rows={data.items}
              getRowKey={(row) => row.id}
              caption={t('admin.users.title')}
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

      <UserFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={async (payload) => {
          const ok = await run(
            () => managementService.createUser({ role, actorId: user.userId, payload }),
            'admin.users.created',
          );
          if (ok) setAddOpen(false);
        }}
        targetRole={addRole}
        status={status}
      />

      {/* تغيير الدور: ترقية أو تنزيل */}
      <Modal
        open={Boolean(roleChangeFor)}
        onClose={() => setRoleChangeFor(null)}
        title={t('admin.users.changeRoleTitle', { name: roleChangeFor?.name ?? '' })}
        description={t('admin.users.changeRoleHint')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoleChangeFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              status={status}
              data-testid="confirm-role-change"
              onClick={async () => {
                const ok = await run(
                  () =>
                    managementService.changeUserRole({
                      role,
                      userId: roleChangeFor.id,
                      nextRole,
                    }),
                  'admin.users.roleChanged',
                );
                if (ok) setRoleChangeFor(null);
              }}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <RadioGroup
          legend={t('admin.tableRole')}
          name="next-role"
          value={nextRole}
          onChange={setNextRole}
          options={MANAGED_ROLES.map((item) => ({ value: item, label: t(`roles.${item}`) }))}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const ok = await run(
            () => managementService.deleteUser({ role, userId: deleting.id }),
            'admin.users.deleted',
          );
          if (ok) setDeleting(null);
        }}
        title={t('admin.users.deleteTitle', { name: deleting?.name ?? '' })}
        message={t('admin.users.deleteConfirm')}
        confirmLabel={t('common.delete')}
        variant="danger"
        status={status}
      />
    </>
  );
}
