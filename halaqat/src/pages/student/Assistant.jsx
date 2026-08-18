import { useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAssistantDuty from '../../hooks/useAssistantDuty.js';
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
  Field,
  Input,
  Textarea,
  ProgressBar,
  EmptyState,
} from '../../components/ui/index.js';

/**
 * مهمة المساعد عند الطالب.
 *
 * صفحة مؤقتة بحكم طبيعتها: تظهر ما دام هناك توكيل نشِط، وتُخلي نفسها فور
 * اكتمال الأسماء. الطالب هنا يسمع مراجعة زملاء بأعيانهم، لا أكثر.
 */
export default function StudentAssistant() {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();
  const { duty, reload } = useAssistantDuty();

  const [target, setTarget] = useState(null);
  const [mastery, setMastery] = useState('85');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const delegation = duty?.delegation ?? null;

  const openRecord = (item) => {
    setMastery('85');
    setNote('');
    setTarget(item);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await assistantService.recordReview({
        assistantStudentId: user.studentId,
        delegationId: delegation.id,
        studentId: target.studentId,
        mastery: Number(mastery),
        note,
      });
      setTarget(null);
      // انتهاء الأسماء ⇒ انتهاء المهمة: نقولها صراحةً بدل أن تختفي الصفحة بلا تفسير.
      toast.success(result.closed ? t('student.assistant.completed') : t('student.assistant.saved'));
      await reload();
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
    } finally {
      setSaving(false);
    }
  };

  const breadcrumb = [
    { label: t('nav.home'), to: '/app/student' },
    { label: t('nav.assistantDuty') },
  ];

  if (!duty?.active) {
    return (
      <>
        <PageHeader title={t('nav.assistantDuty')} breadcrumb={breadcrumb} />
        <EmptyState
          icon="⭐"
          title={t('student.assistant.noDuty')}
          text={t('student.assistant.noDutyHint')}
          action={
            <Button variant="secondary" to="/app/student">
              {t('nav.dashboard')}
            </Button>
          }
        />
        {duty?.history?.length ? (
          <Section id="duty-history" title={t('student.assistant.historyTitle')}>
            <div className="stack-2">
              {duty.history.map((item) => (
                <Card key={item.id} variant="quiet">
                  <div className="row row-2 row-between row-wrap">
                    <span className="t-sm">
                      {t('teacher.assistant.progress', {
                        done: item.progress.done,
                        total: item.progress.total,
                      })}
                    </span>
                    <span className="t-sm t-muted">
                      {formatRelative(item.completedAt ?? item.createdAt, t)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        ) : null}
      </>
    );
  }

  const pending = delegation.items.filter((item) => item.status !== 'done');

  return (
    <>
      <PageHeader
        title={t('student.assistant.dutyTitle')}
        subtitle={t('student.assistant.dutySubtitle', {
          teacher: delegation.teacherName,
          circle: delegation.circleName,
        })}
        breadcrumb={breadcrumb}
      />

      <Alert variant="info" title={t('student.assistant.scopeNotice')}>
        {t('student.assistant.scopeNoticeText')}
      </Alert>

      <Card>
        <ProgressBar
          value={delegation.progress.done}
          max={delegation.progress.total}
          label={t('teacher.assistant.progress', {
            done: delegation.progress.done,
            total: delegation.progress.total,
          })}
        />
        <p className="t-sm t-muted">
          {t('student.assistant.remaining', { count: pending.length })}
        </p>
        {delegation.note ? (
          <p className="t-sm">
            <strong>{t('student.assistant.noteFromTeacher')}:</strong> {delegation.note}
          </p>
        ) : null}
      </Card>

      <Section id="duty-items" title={t('teacher.assistant.delegateStudents')}>
        <div className="stack-2">
          {delegation.items.map((item) => (
            <Card key={item.studentId} variant="quiet" data-testid="duty-item">
              <div className="row row-2 row-between row-wrap">
                <div className="stack-1">
                  <p className="t-strong">{item.studentName}</p>
                  {item.status === 'done' ? (
                    <p className="t-sm t-muted">
                      {t('teacher.assistant.mastery')}: {formatPercent(item.mastery)} ·{' '}
                      {formatRelative(item.doneAt, t)}
                    </p>
                  ) : null}
                </div>
                <div className="row row-2">
                  <Badge variant={item.status === 'done' ? 'success' : 'neutral'}>
                    {t(`teacher.assistant.itemStatus.${item.status}`)}
                  </Badge>
                  {item.status !== 'done' ? (
                    <Button size="sm" onClick={() => openRecord(item)} data-testid="record-review">
                      {t('student.assistant.record')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={target ? t('student.assistant.recordFor', { name: target.studentName }) : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="record-review-form"
              status={saving ? 'loading' : 'idle'}
              data-testid="record-submit"
            >
              {t('student.assistant.submit')}
            </Button>
          </>
        }
      >
        <form id="record-review-form" className="stack-3" onSubmit={submit}>
          <Field label={t('student.assistant.masteryLabel')} hint={t('student.assistant.masteryHint')}>
            <Input
              type="number"
              min="0"
              max="100"
              value={mastery}
              onChange={(event) => setMastery(event.target.value)}
              required
            />
          </Field>
          <Field label={t('student.assistant.noteLabel')}>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('student.assistant.notePlaceholder')}
              rows={3}
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
