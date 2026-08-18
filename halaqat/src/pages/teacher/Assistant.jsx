import { useCallback, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as assistantService from '../../services/assistantService.js';
import { formatPercent, formatRelative } from '../../lib/format.js';
import {
  PageHeader,
  Section,
  Card,
  Button,
  Badge,
  Alert,
  Modal,
  ConfirmDialog,
  Field,
  Textarea,
  ProgressBar,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';
import { Checkbox } from '../../components/ui/Choice.jsx';

const DELEGATION_VARIANT = { active: 'info', completed: 'success', cancelled: 'warning' };

/** لا نغرق الصفحة بالمرشحين: الأعلى إتقانًا أولًا، والبقية خلف إفصاح. */
const ELIGIBLE_PREVIEW = 6;

/**
 * قسم «الطالب المتميز ومساعد المعلم».
 *
 * ثلاث طبقات بالترتيب: من يستحق التعيين، من عُيّن، ثم ما وُكِّل به.
 * حدود الدور معروضة نصًّا لا مضمرة: التوكيل مراجعة فقط ولا يمنح رتبة معلم.
 */
export default function TeacherAssistant() {
  const t = useT();
  const { user, role } = useAuth();
  const toast = useToast();

  const [delegateFor, setDelegateFor] = useState(null);
  const [picked, setPicked] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(null);
  const [showAllEligible, setShowAllEligible] = useState(false);

  const fetcher = useCallback(
    () => assistantService.getAssistantPanel({ role, teacherId: user.id, circleId: user.circleId }),
    [role, user.id, user.circleId],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [role, user.id, user.circleId]);

  const handleAssistant = async (student, next) => {
    try {
      await assistantService.setAssistant({ role, studentId: student.id, isAssistant: next });
      toast.success(next ? t('teacher.assistant.assigned') : t('teacher.assistant.unassigned'));
      refetch();
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
    }
  };

  const openDelegate = (assistant) => {
    setPicked([]);
    setNote('');
    setDelegateFor(assistant);
  };

  const togglePick = (studentId, checked) => {
    setPicked((prev) => (checked ? [...prev, studentId] : prev.filter((id) => id !== studentId)));
  };

  const submitDelegation = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await assistantService.createDelegation({
        role,
        teacherId: user.id,
        circleId: user.circleId,
        assistantStudentId: delegateFor.id,
        studentIds: picked,
        note,
      });
      toast.success(t('teacher.assistant.delegateCreated'));
      setDelegateFor(null);
      refetch();
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
    } finally {
      setSaving(false);
    }
  };

  const confirmFinish = async () => {
    try {
      await assistantService.completeDelegation({ role, delegationId: finishing.id });
      toast.success(t('teacher.assistant.finished'));
      refetch();
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
    } finally {
      setFinishing(null);
    }
  };

  // المرشحون للتوكيل: زملاء المساعد في الحلقة.
  const peersOf = (assistantId) =>
    (data?.circleStudents ?? []).filter((student) => student.id !== assistantId);

  return (
    <>
      <PageHeader
        title={t('teacher.assistant.title')}
        subtitle={t('teacher.assistant.subtitle')}
        breadcrumb={[
          { label: t('nav.home'), to: '/app/teacher' },
          { label: t('teacher.assistant.title') },
        ]}
      />

      <Alert variant="info" title={t('teacher.assistant.scopeNotice')}>
        {t('teacher.assistant.scopeNoticeText')}
      </Alert>

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<PageSkeleton />}
      >
        {data ? (
          <>
            <Section
              id="assistants"
              title={t('teacher.assistant.assistantsTitle')}
              hint={t('teacher.assistant.hint')}
            >
              {data.assistants.length === 0 ? (
                <Card variant="quiet">
                  <p className="t-muted">{t('teacher.assistant.assistantsEmpty')}</p>
                </Card>
              ) : (
                <div className="grid grid-2">
                  {data.assistants.map((assistant) => (
                    <Card key={assistant.id} data-testid="assistant-card">
                      <div className="row row-2 row-between">
                        <div className="stack-1">
                          <p className="t-strong">
                            {assistant.name}{' '}
                            <Badge variant="success" icon="★">
                              {t('teacher.assistant.badge')}
                            </Badge>
                          </p>
                          <p className="t-sm t-muted">
                            {t('teacher.assistant.mastery')}: {formatPercent(assistant.masteryAvg)} ·{' '}
                            {t('teacher.assistant.completedCount')}: {assistant.completedCount}
                          </p>
                        </div>
                      </div>

                      <div className="row row-2 row-wrap">
                        <Button
                          size="sm"
                          onClick={() => openDelegate(assistant)}
                          disabled={Boolean(assistant.activeDelegationId)}
                          data-testid="delegate-open"
                        >
                          {t('teacher.assistant.delegate')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAssistant(assistant, false)}
                        >
                          {t('teacher.assistant.unassign')}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Section>

            <Section
              id="eligible"
              title={t('teacher.assistant.eligibleTitle')}
              hint={t('teacher.assistant.eligibleHint', { min: data.eligibilityMastery })}
            >
              {data.eligible.length === 0 ? (
                <Card variant="quiet">
                  <p className="t-muted">{t('teacher.assistant.eligibleEmpty')}</p>
                </Card>
              ) : (
                <div className="grid grid-3">
                  {(showAllEligible
                    ? data.eligible
                    : data.eligible.slice(0, ELIGIBLE_PREVIEW)
                  ).map((student) => (
                    <Card key={student.id} variant="quiet" data-testid="eligible-card">
                      <p className="t-strong">{student.name}</p>
                      <p className="t-sm t-muted">
                        {t('teacher.assistant.mastery')}: {formatPercent(student.masteryAvg)} ·{' '}
                        {t('teacher.assistant.attendance')}: {formatPercent(student.attendanceRate)}
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAssistant(student, true)}
                        data-testid="assign-assistant"
                      >
                        {t('teacher.assistant.assign')}
                      </Button>
                    </Card>
                  ))}
                </div>
              )}

              {data.eligible.length > ELIGIBLE_PREVIEW ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllEligible((prev) => !prev)}
                  aria-expanded={showAllEligible}
                >
                  {showAllEligible
                    ? t('teacher.assistant.showLess')
                    : t('teacher.assistant.showAll', { count: data.eligible.length })}
                </Button>
              ) : null}
            </Section>

            <Section id="delegations" title={t('teacher.assistant.delegationsTitle')}>
              {data.delegations.length === 0 ? (
                <Card variant="quiet">
                  <p className="t-muted">{t('teacher.assistant.delegationsEmpty')}</p>
                </Card>
              ) : (
                <div className="stack-3">
                  {data.delegations.map((delegation) => (
                    <Card key={delegation.id} data-testid="delegation-card">
                      <div className="row row-2 row-between row-wrap">
                        <div className="stack-1">
                          <p className="t-strong">{delegation.assistantName}</p>
                          <p className="t-sm t-muted">
                            {t('teacher.assistant.delegationScope')} ·{' '}
                            {formatRelative(delegation.createdAt, t)}
                          </p>
                        </div>
                        <Badge variant={DELEGATION_VARIANT[delegation.status]}>
                          {t(`teacher.assistant.status.${delegation.status}`)}
                        </Badge>
                      </div>

                      <ProgressBar
                        value={delegation.progress.done}
                        max={delegation.progress.total}
                        label={t('teacher.assistant.progress', {
                          done: delegation.progress.done,
                          total: delegation.progress.total,
                        })}
                      />

                      <ul className="delegation-items">
                        {delegation.items.map((item) => (
                          <li key={item.studentId}>
                            <span>{item.studentName}</span>
                            <span className="row row-2">
                              {item.status === 'done' ? (
                                <span className="tnum t-sm t-muted">
                                  {formatPercent(item.mastery)}
                                </span>
                              ) : null}
                              <Badge variant={item.status === 'done' ? 'success' : 'neutral'}>
                                {t(`teacher.assistant.itemStatus.${item.status}`)}
                              </Badge>
                            </span>
                          </li>
                        ))}
                      </ul>

                      {delegation.note ? <p className="t-sm t-muted">{delegation.note}</p> : null}

                      {delegation.status === 'active' ? (
                        <Button size="sm" variant="ghost" onClick={() => setFinishing(delegation)}>
                          {t('teacher.assistant.finishEarly')}
                        </Button>
                      ) : null}
                    </Card>
                  ))}
                </div>
              )}
            </Section>
          </>
        ) : null}
      </DataState>

      <Modal
        open={Boolean(delegateFor)}
        onClose={() => setDelegateFor(null)}
        title={t('teacher.assistant.delegateTitle')}
        description={
          delegateFor ? t('teacher.assistant.delegateFor', { name: delegateFor.name }) : ''
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDelegateFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="delegate-form"
              status={saving ? 'loading' : 'idle'}
              data-testid="delegate-submit"
            >
              {t('teacher.assistant.delegateSubmit')}
            </Button>
          </>
        }
      >
        <form id="delegate-form" className="stack-3" onSubmit={submitDelegation}>
          <Alert variant="info">{t('teacher.assistant.scopeNoticeText')}</Alert>

          <Field
            label={t('teacher.assistant.delegateStudents')}
            hint={t('teacher.assistant.delegateStudentsHint', { max: data?.maxItems ?? 6 })}
          >
            <div className="stack-2">
              {(delegateFor ? peersOf(delegateFor.id) : []).map((student) => (
                <Checkbox
                  key={student.id}
                  card
                  label={student.name}
                  hint={`${t('teacher.assistant.mastery')}: ${formatPercent(student.masteryAvg)}`}
                  checked={picked.includes(student.id)}
                  onChange={(checked) => togglePick(student.id, checked)}
                />
              ))}
            </div>
          </Field>

          <Field label={t('teacher.assistant.delegateNote')}>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('teacher.assistant.delegateNotePlaceholder')}
              rows={3}
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(finishing)}
        onClose={() => setFinishing(null)}
        onConfirm={confirmFinish}
        title={t('teacher.assistant.finishEarly')}
        message={t('teacher.assistant.finishConfirm')}
        variant="danger"
      />
    </>
  );
}
