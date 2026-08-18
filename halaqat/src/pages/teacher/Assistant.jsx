import { useCallback, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as assistantService from '../../services/assistantService.js';
import * as distinguishedService from '../../services/distinguishedService.js';
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
  Skeleton,
  Select,
  Input,
} from '../../components/ui/index.js';
import { Checkbox, RadioGroup } from '../../components/ui/Choice.jsx';
import DistinguishedList from '../../components/distinguished/DistinguishedList.jsx';

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
  const [month, setMonth] = useState('current');
  const [selectionMode, setSelectionMode] = useState('teacher');
  const [quota, setQuota] = useState('3');

  const fetcher = useCallback(
    () => assistantService.getAssistantPanel({ role, teacherId: user.userId, circleId: user.circleId }),
    [role, user.userId, user.circleId],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [role, user.userId, user.circleId]);

  const monthlyFetcher = useCallback(
    () =>
      distinguishedService.listMonthlyDistinguished({
        role,
        userId: user.userId,
        circleId: user.circleId,
        month,
      }),
    [role, user.userId, user.circleId, month],
  );
  const monthly = useAsyncData(monthlyFetcher, [role, user.userId, user.circleId, month]);
  const monthlyRows = monthly.data?.circles?.[0]?.students ?? [];

  const handleAssistant = async (student, next) => {
    try {
      await assistantService.setAssistant({ role, studentId: student.id, isAssistant: next });
      toast.success(next ? t('teacher.assistant.assigned') : t('teacher.assistant.unassigned'));
      refetch();
      monthly.refetch();
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
    }
  };

  const openDelegate = (assistant) => {
    setPicked([]);
    setNote('');
    setSelectionMode('teacher');
    setQuota('3');
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
        teacherId: user.userId,
        circleId: user.circleId,
        assistantStudentId: delegateFor.id,
        studentIds: picked,
        selectionMode,
        quota: Number(quota),
        note,
      });
      toast.success(t('teacher.assistant.delegateCreated'));
      setDelegateFor(null);
      refetch();
      monthly.refetch();
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
            {/* متميزو الشهر: من نشاط الشهر نفسه، ومنه يختار المعلم مساعده. */}
            <Section
              id="monthly"
              title={t('distinguished.title')}
              hint={t('distinguished.teacherSubtitle')}
              actions={
                <Select
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  aria-label={t('distinguished.monthLabel')}
                  data-testid="month-select"
                >
                  <option value="current">{t('distinguished.monthCurrent')}</option>
                  <option value="previous">{t('distinguished.monthPrevious')}</option>
                </Select>
              }
            >
              <DataState
                loading={monthly.loading}
                error={monthly.error}
                onRetry={monthly.refetch}
                loadingFallback={<Skeleton variant="card" count={3} height={64} />}
              >
                {monthly.data ? (
                  <div className="stack-3">
                    <p className="t-sm t-muted">
                      {t('distinguished.criteriaText', {
                        mastery: monthly.data.criteria.minMastery,
                        attendance: monthly.data.criteria.minAttendance,
                        sessions: monthly.data.criteria.minSessions,
                      })}
                    </p>

                    {monthlyRows.length === 0 ? (
                      <Card variant="quiet">
                        <p className="t-muted">{t('distinguished.empty')}</p>
                        <p className="t-sm t-muted">{t('distinguished.emptyHint')}</p>
                      </Card>
                    ) : (
                      <DistinguishedList
                        rows={monthlyRows}
                        profileBase="/app/teacher/students"
                        action={(row) =>
                          row.isAssistant ? null : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleAssistant(row, true)}
                              data-testid="assign-from-monthly"
                            >
                              {t('teacher.assistant.assign')}
                            </Button>
                          )
                        }
                      />
                    )}
                  </div>
                ) : null}
              </DataState>
            </Section>

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
                <div className="grid grid-2 stagger">
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
                <div className="grid grid-3 stagger">
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
                        <span className="row row-2">
                          <Badge variant="neutral">
                            {t(`teacher.assistant.modeBadge.${delegation.selectionMode ?? 'teacher'}`)}
                          </Badge>
                          <Badge variant={DELEGATION_VARIANT[delegation.status]}>
                            {t(`teacher.assistant.status.${delegation.status}`)}
                          </Badge>
                        </span>
                      </div>

                      <ProgressBar
                        value={delegation.progress.done}
                        max={delegation.progress.total}
                        label={t('teacher.assistant.progress', {
                          done: delegation.progress.done,
                          total: delegation.progress.total,
                        })}
                      />

                      {delegation.progress.toChoose > 0 ? (
                        <p className="t-sm t-muted">
                          {t('teacher.assistant.awaitingChoice')} ·{' '}
                          {t('teacher.assistant.chosenProgress', {
                            chosen: delegation.progress.chosen,
                            total: delegation.progress.total,
                          })}
                        </p>
                      ) : null}

                      <ul className="delegation-items">
                        {delegation.items.map((item) => (
                          <li key={item.studentId}>
                            <span>
                              {item.studentName}
                              {item.chosenBy === 'assistant' ? (
                                <span className="t-sm t-muted">
                                  {' '}
                                  · {t('teacher.assistant.chosenByAssistant')}
                                </span>
                              ) : null}
                            </span>
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

          <RadioGroup
            legend={t('teacher.assistant.selectionLegend')}
            name="selection-mode"
            value={selectionMode}
            onChange={setSelectionMode}
            options={[
              {
                value: 'teacher',
                label: t('teacher.assistant.selectionByTeacher'),
                hint: t('teacher.assistant.selectionByTeacherHint'),
              },
              {
                value: 'assistant',
                label: t('teacher.assistant.selectionByAssistant'),
                hint: t('teacher.assistant.selectionByAssistantHint'),
              },
            ]}
          />

          {selectionMode === 'assistant' ? (
            <Field
              label={t('teacher.assistant.quotaLabel')}
              hint={t('teacher.assistant.quotaHint', { max: data?.maxItems ?? 6 })}
            >
              <Input
                type="number"
                min="1"
                max={data?.maxItems ?? 6}
                value={quota}
                onChange={(event) => setQuota(event.target.value)}
                data-testid="delegate-quota"
                required
              />
            </Field>
          ) : (
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
          )}

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
