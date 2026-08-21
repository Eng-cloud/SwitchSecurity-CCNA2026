import { useCallback, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as managementService from '../../services/managementService.js';
import { ROLE_HOME } from '../../config/navigation.js';
import { formatNumber, formatRelative } from '../../lib/format.js';
import {
  PageHeader,
  Tabs,
  Card,
  Button,
  Badge,
  Modal,
  Field,
  Textarea,
  ConfirmDialog,
  DataState,
  Skeleton,
} from '../../components/ui/index.js';

const STATUS_VARIANT = { pending: 'warning', approved: 'success', rejected: 'danger' };

/** مراجعة طلبات تسجيل الأبناء — للمشرف والإدارة. */
export default function EnrollmentRequests() {
  const t = useT();
  const { role, user } = useAuth();
  const toast = useToast();
  const { values, setValue } = useListState({ defaults: { tab: 'pending' } });

  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('idle');

  const fetcher = useCallback(
    () =>
      managementService.listEnrollmentRequests({
        role,
        userId: user.userId,
        status: values.tab,
      }),
    [role, user.userId, values.tab],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [role, user.userId, values.tab]);

  const decide = async (requestItem, decision, rejectionReason) => {
    setStatus('loading');
    try {
      await managementService.decideEnrollmentRequest({
        role,
        actorId: user.userId,
        requestId: requestItem.id,
        decision,
        reason: rejectionReason,
      });
      toast.success(decision === 'approve' ? t('requests.approved_toast') : t('requests.rejected_toast'));
      setApproving(null);
      setRejecting(null);
      setReason('');
      refetch();
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
    } finally {
      setStatus('idle');
    }
  };

  const tabs = [
    { value: 'pending', label: t('requests.pending') },
    { value: 'approved', label: t('requests.approved') },
    { value: 'rejected', label: t('requests.rejected') },
  ];

  return (
    <>
      <PageHeader
        title={t('requests.title')}
        subtitle={t('requests.subtitle')}
        breadcrumb={[
          { label: t('nav.home'), to: ROLE_HOME[role] ?? '/app' },
          { label: t('requests.title') },
        ]}
      />

      <Tabs
        tabs={tabs}
        value={values.tab}
        onChange={(tab) => setValue('tab', tab)}
        label={t('requests.title')}
      >
        <DataState
          loading={loading}
          error={error}
          onRetry={refetch}
          isEmpty={(data ?? []).length === 0}
          emptyTitle={t('requests.title')}
          emptyText={t('requests.empty')}
          loadingFallback={<Skeleton variant="card" count={3} height={140} />}
        >
          <ul className="stack-3">
            {(data ?? []).map((item) => (
              <li key={item.id}>
                <Card className="stack-4" data-testid="request-card">
                  <div className="row row-between row-wrap">
                    <div>
                      <p className="t-lg t-semibold">{item.childName}</p>
                      <p className="t-xs t-muted">
                        {t('requests.parent')}: {item.parentName}
                        {item.age ? ` · ${formatNumber(item.age)} سنة` : ''}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[item.status]}>
                      {t(`parent.requests.status.${item.status}`)}
                    </Badge>
                  </div>

                  <dl className="info-list">
                    <div className="info-list__item">
                      <dt className="info-list__label">{t('requests.location')}</dt>
                      <dd className="info-list__value">
                        {item.city} · {item.district} · {item.mosque}
                      </dd>
                    </div>
                    <div className="info-list__item">
                      <dt className="info-list__label">{t('requests.circle')}</dt>
                      <dd className="info-list__value">{item.circleName}</dd>
                    </div>
                    <div className="info-list__item">
                      <dt className="info-list__label">{t('requests.submittedAt')}</dt>
                      <dd className="info-list__value">{formatRelative(item.createdAt, t)}</dd>
                    </div>
                  </dl>

                  {item.note ? <p className="t-sm t-secondary">{item.note}</p> : null}

                  {item.status === 'pending' ? (
                    <div className="row row-3 row-wrap">
                      <Button onClick={() => setApproving(item)} data-testid="approve-request">
                        {t('requests.approve')}
                      </Button>
                      <Button variant="secondary" onClick={() => setRejecting(item)}>
                        {t('requests.reject')}
                      </Button>
                    </div>
                  ) : (
                    <p className="t-xs t-muted">
                      {item.decidedByName
                        ? t('parent.requests.decidedBy', { name: item.decidedByName })
                        : ''}
                      {item.rejectionReason ? ` — ${item.rejectionReason}` : ''}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </DataState>
      </Tabs>

      <ConfirmDialog
        open={Boolean(approving)}
        onClose={() => setApproving(null)}
        onConfirm={() => decide(approving, 'approve')}
        title={t('requests.confirmApproveTitle', { name: approving?.childName ?? '' })}
        message={t('requests.confirmApproveText', { circle: approving?.circleName ?? '' })}
        confirmLabel={t('requests.approve')}
        status={status}
      />

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={t('requests.rejectTitle', { name: rejecting?.childName ?? '' })}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" status={status} onClick={() => decide(rejecting, 'reject', reason)}>
              {t('requests.reject')}
            </Button>
          </>
        }
      >
        <Field label={t('requests.rejectReason')} optional>
          <Textarea
            rows={3}
            value={reason}
            placeholder={t('requests.rejectReasonPlaceholder')}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </Modal>
    </>
  );
}
