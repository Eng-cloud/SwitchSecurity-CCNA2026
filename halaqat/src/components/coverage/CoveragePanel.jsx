import { useCallback, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as coverageService from '../../services/coverageService.js';
import { can, ACTIONS } from '../../config/permissions.js';
import AttendanceSelect from '../attendance/AttendanceSelect.jsx';
import { Card, Badge, Button, Select, Field, Skeleton, Alert } from '../ui/index.js';

/** حالات التغطية ولون كل منها — الإلحاح يُقرأ من اللون قبل النص. */
const STATE_VARIANT = {
  onSite: 'success',
  deputized: 'info',
  pending: 'warning',
  needsCover: 'danger',
  escalated: 'danger',
};

/**
 * لوحة يوم الحلقة: من يقودها اليوم؟
 *
 * تجمع في مكان واحد ما كان مفرَّقًا: حضور المعلم نفسه، وطلب الإنابة عند
 * غيابه، وردّ النائب، وتدخّل المشرف حين لا يردّ أحد. الترتيب مقصود —
 * السؤال أولًا («الحلقة بلا معلّم»)، ثم الإجراء الذي يجيب عنه.
 */
export default function CoveragePanel({ circleId, onChange }) {
  const t = useT();
  const { role, user } = useAuth();
  const toast = useToast();

  const [deputyId, setDeputyId] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchDay = useCallback(
    () => coverageService.getCircleDay({ role, userId: user?.userId, circleId }),
    [role, user?.userId, circleId],
  );
  const { data, loading, error, refetch } = useAsyncData(fetchDay, [role, user?.userId, circleId]);

  const fetchCandidates = useCallback(
    () => coverageService.listDeputyCandidates({ role, userId: user?.userId, circleId }),
    [role, user?.userId, circleId],
  );
  const { data: candidates } = useAsyncData(fetchCandidates, [role, user?.userId, circleId]);

  /** ينفّذ إجراءً، ثم يحدّث اللوحة والصفحة التي تحويها. */
  const run = async (action, successKey) => {
    setBusy(true);
    try {
      await action();
      toast.success(t(successKey));
      await refetch();
      await onChange?.();
      return true;
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Skeleton variant="card" height={120} />;
  if (error || !data) return null;

  // شرطان: صلاحية الميدان في المصفوفة، وسلطةٌ على هذه الحلقة بعينها.
  const inField = can(role, ACTIONS.COVERAGE_MANAGE);
  const mayRecord = inField && (data.authority === 'teacher' || data.authority === 'supervisor');
  const maySupervise = inField && data.authority === 'supervisor';
  const isDeputy = data.authority === 'deputy';
  const needsCover = data.state === 'needsCover' || data.state === 'escalated';
  const deputation = data.deputation;

  return (
    <Card className="coverage">
      <div className="row row-4 row-wrap coverage__head">
        <div className="grow">
          <p className="t-sm t-muted">{t('coverage.title')}</p>
          <p className="t-lg t-semibold">
            {data.teacher?.name ?? t('coverage.noTeacher')}{' '}
            <Badge variant={STATE_VARIANT[data.state]}>{t(`coverage.state.${data.state}`)}</Badge>
          </p>
          {data.recordedByRole && data.recordedByRole !== 'teacher' ? (
            <p className="t-xs t-muted">
              {t('coverage.recordedBy', {
                name: data.recordedByName,
                role: t(`roles.${data.recordedByRole}`),
              })}
            </p>
          ) : null}
        </div>

        <Field label={t('coverage.teacherAttendance')} className="shrink-0">
          <AttendanceSelect
            data-testid="teacher-attendance"
            name={data.teacher?.name ?? ''}
            labelKey="coverage.teacherAttendanceLabel"
            value={data.teacherStatus}
            busy={busy}
            disabled={!mayRecord}
            onChange={(status) =>
              run(
                () =>
                  coverageService.setTeacherAttendance({
                    role,
                    userId: user?.userId,
                    userName: user?.name,
                    circleId,
                    status,
                  }),
                'coverage.saved',
              )
            }
          />
        </Field>
      </div>

      {/* النائب يعرف من أين جاءت سلطته على حلقة ليست حلقته. */}
      {isDeputy ? (
        <Alert variant="info" title={t('coverage.deputyBannerTitle')}>
          {t('coverage.deputyBannerText', { teacher: data.teacher?.name ?? '' })}
        </Alert>
      ) : null}

      {/* غاب المعلم ولا أحد يقود الحلقة — هنا يبدأ طريق الإنابة. */}
      {needsCover && (mayRecord || maySupervise) ? (
        <div className="stack-3 coverage__request">
          <Alert
            variant={data.state === 'escalated' ? 'danger' : 'warning'}
            title={t(`coverage.alert.${data.state}`)}
          >
            {data.state === 'escalated' && deputation?.declineReason
              ? t('coverage.declinedBecause', {
                  name: deputation.deputyName,
                  reason: deputation.declineReason,
                })
              : t('coverage.alertHint')}
          </Alert>

          <div className="row row-4 row-wrap row-end">
            <Field label={t('coverage.pickDeputy')} className="grow">
              <Select
                value={deputyId}
                data-testid="deputy-picker"
                onChange={(event) => setDeputyId(event.target.value)}
              >
                <option value="">{t('coverage.pickDeputyPlaceholder')}</option>
                {(candidates ?? []).map((candidate) => (
                  <option key={candidate.id} value={candidate.id} disabled={candidate.busy}>
                    {candidate.name}
                    {candidate.circleName ? ` — ${candidate.circleName}` : ''}
                    {candidate.busy ? ` (${t(`coverage.busy.${candidate.busyReason}`)})` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <Button
              disabled={!deputyId}
              status={busy ? 'loading' : 'idle'}
              data-testid="request-deputy"
              onClick={() =>
                run(
                  () =>
                    coverageService.requestDeputy({
                      role,
                      userId: user?.userId,
                      userName: user?.name,
                      circleId,
                      deputyId,
                    }),
                  'coverage.requested',
                ).then((ok) => ok && setDeputyId(''))
              }
            >
              {t('coverage.requestDeputy')}
            </Button>

            {/* آخر السلسلة: لا تُترك حلقة بلا قائد لأن أحدًا لم يقبل. */}
            {maySupervise ? (
              <Button
                variant="secondary"
                status={busy ? 'loading' : 'idle'}
                data-testid="claim-coverage"
                onClick={() =>
                  run(
                    () =>
                      coverageService.claimCoverage({
                        role,
                        userId: user?.userId,
                        userName: user?.name,
                        circleId,
                      }),
                    'coverage.claimed',
                  )
                }
              >
                {t('coverage.claim')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* طلبٌ بانتظار ردّ، أو إنابة قائمة — كلاهما يُنهى من مكانه. */}
      {deputation && (data.state === 'pending' || data.state === 'deputized') ? (
        <div className="row row-4 row-wrap coverage__active">
          <p className="grow t-sm">
            {t(data.state === 'pending' ? 'coverage.waitingOn' : 'coverage.ledBy', {
              name: deputation.deputyName,
              role: t(`roles.${deputation.deputyRole}`),
            })}
            {deputation.declineReason ? ` — ${deputation.declineReason}` : ''}
          </p>
          {mayRecord ? (
            <Button
              size="sm"
              variant="ghost"
              status={busy ? 'loading' : 'idle'}
              data-testid="end-deputation"
              onClick={() =>
                run(
                  () =>
                    coverageService.endDeputation({
                      role,
                      userId: user?.userId,
                      deputationId: deputation.id,
                    }),
                  'coverage.ended',
                )
              }
            >
              {t('coverage.end')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
