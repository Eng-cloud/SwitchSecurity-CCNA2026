import { useCallback, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as coverageService from '../../services/coverageService.js';
import { Card, Button, Alert, Field, Textarea, Modal } from '../ui/index.js';

/**
 * صندوق النائب — ما طُلب منك اليوم، وما تقوده فعلًا.
 *
 * يظهر عند الطلب فقط ويختفي بعده: بانرٌ دائم لا مضمون له ضجيج.
 * والاعتذار إجراء مشروع لا هروب — لذلك له زرّ صريح وسببٌ يُكتب،
 * لأن السبب هو ما يبني عليه المشرف قراره التالي.
 */
export default function DeputyInbox({ onChange }) {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();

  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback(
    () => coverageService.getDeputyInbox({ userId: user?.userId }),
    [user?.userId],
  );
  const { data, refetch } = useAsyncData(fetcher, [user?.userId]);

  const respond = async (deputation, accept, why = '') => {
    setBusy(true);
    try {
      await coverageService.respondToDeputy({
        userId: user?.userId,
        deputationId: deputation.id,
        accept,
        reason: why,
      });
      toast.success(t(accept ? 'coverage.accepted' : 'coverage.declined'));
      await refetch();
      await onChange?.();
      return true;
    } catch (error) {
      toast.error(t(error?.messageKey ?? 'state.errorHint'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const pending = data?.pending ?? [];
  const active = data?.active ?? [];
  if (pending.length === 0 && active.length === 0) return null;

  return (
    <>
      {pending.map((deputation) => (
        <Card key={deputation.id} className="stack-3" data-testid="deputy-request">
          <Alert variant="warning" title={t('coverage.inbox.title')}>
            {t('coverage.inbox.text', {
              teacher: deputation.absentTeacherName,
              circle: deputation.circleName,
              by: deputation.requestedByName,
            })}
          </Alert>
          <div className="row row-4 row-wrap">
            <Button
              status={busy ? 'loading' : 'idle'}
              data-testid="accept-deputy"
              onClick={() => respond(deputation, true)}
            >
              {t('coverage.accept')}
            </Button>
            <Button
              variant="ghost"
              data-testid="decline-deputy"
              onClick={() => setDeclining(deputation)}
            >
              {t('coverage.decline')}
            </Button>
          </div>
        </Card>
      ))}

      {active.map((deputation) => (
        <Card key={deputation.id} className="row row-4 row-wrap" data-testid="deputy-active">
          <p className="grow">
            {t('coverage.inbox.active', {
              teacher: deputation.absentTeacherName,
              circle: deputation.circleName,
            })}
          </p>
          <Button variant="secondary" to={`/app/teacher/cover/${deputation.circleId}`}>
            {t('coverage.openCircle')}
          </Button>
        </Card>
      ))}

      <Modal
        open={Boolean(declining)}
        onClose={() => setDeclining(null)}
        title={t('coverage.declineTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclining(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              status={busy ? 'loading' : 'idle'}
              data-testid="confirm-decline"
              onClick={async () => {
                const ok = await respond(declining, false, reason);
                if (ok) {
                  setDeclining(null);
                  setReason('');
                }
              }}
            >
              {t('coverage.decline')}
            </Button>
          </>
        }
      >
        <Field label={t('coverage.declineReason')} optional>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('coverage.declineReasonPlaceholder')}
            data-testid="decline-reason"
          />
        </Field>
      </Modal>
    </>
  );
}
