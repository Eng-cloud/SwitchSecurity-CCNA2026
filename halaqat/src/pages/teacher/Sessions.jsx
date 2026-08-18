import { useCallback, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as teacherService from '../../services/teacherService.js';
import { SURAHS_WITH_TEXT } from '../../mock/quran.js';
import { formatNumber, formatPercent, formatRelative } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Button,
  Field,
  Select,
  Textarea,
  SegmentedControl,
  Badge,
  DataState,
  Skeleton,
  Section,
} from '../../components/ui/index.js';

const TYPES = ['memorization', 'review', 'test'];
const GRADES = ['excellent', 'good', 'needsWork'];

/** تسجيل جلسة تسميع لطالب من الحلقة. */
export default function TeacherSessions() {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('idle');
  const [recent, setRecent] = useState([]);
  const [form, setForm] = useState({
    studentId: '',
    type: 'memorization',
    surahNumber: SURAHS_WITH_TEXT[0].number,
    fromAyah: 1,
    toAyah: 3,
    grade: 'good',
    notes: '',
  });

  const fetcher = useCallback(
    () => teacherService.getCircleStudents(user.circleId, { perPage: 50 }),
    [user.circleId],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.circleId]);

  const students = data?.items ?? [];
  const selectedSurah = SURAHS_WITH_TEXT.find((item) => item.number === Number(form.surahNumber));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const studentId = form.studentId || students[0]?.id;
    if (!studentId) return;

    setStatus('loading');
    try {
      const session = await teacherService.recordSession(studentId, {
        ...form,
        teacherId: user.userId,
      });
      const student = students.find((item) => item.id === studentId);
      setRecent((prev) => [{ ...session, studentName: student?.name ?? '' }, ...prev].slice(0, 6));
      setStatus('success');
      toast.success(t('teacher.session.saved'));
      setForm((prev) => ({ ...prev, notes: '' }));
    } catch {
      setStatus('idle');
      toast.error(t('state.errorHint'));
    }
  };

  return (
    <>
      <PageHeader
        title={t('teacher.session.title')}
        subtitle={t('teacher.session.history')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/teacher' }, { label: t('nav.sessions') }]}
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={false}
        loadingFallback={<Skeleton variant="card" height={320} />}
      >
        <Card className="stack-5">
          <form className="stack-5" onSubmit={handleSubmit}>
            <div className="grid grid-2 stagger">
              <Field label={t('teacher.session.studentLabel')} required>
                <Select
                  value={form.studentId || students[0]?.id || ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, studentId: event.target.value }))}
                >
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('teacher.session.typeLabel')}>
                <Select
                  value={form.type}
                  onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                >
                  {TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`teacher.session.types.${type}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-3 stagger">
              <Field label={t('recitation.surah')}>
                <Select
                  value={form.surahNumber}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      surahNumber: Number(event.target.value),
                      fromAyah: 1,
                      toAyah: 3,
                    }))
                  }
                >
                  {SURAHS_WITH_TEXT.map((surah) => (
                    <option key={surah.number} value={surah.number}>
                      {surah.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('recitation.fromAyah')}>
                <Select
                  value={form.fromAyah}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      fromAyah: Number(event.target.value),
                      toAyah: Math.max(Number(event.target.value), prev.toAyah),
                    }))
                  }
                >
                  {Array.from({ length: selectedSurah?.ayahCount ?? 1 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {formatNumber(index + 1)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('recitation.toAyah')}>
                <Select
                  value={form.toAyah}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, toAyah: Number(event.target.value) }))
                  }
                >
                  {Array.from({ length: selectedSurah?.ayahCount ?? 1 }, (_, index) => index + 1)
                    .filter((value) => value >= form.fromAyah)
                    .map((value) => (
                      <option key={value} value={value}>
                        {formatNumber(value)}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>

            <div className="stack-2">
              <span className="field__label">{t('teacher.session.gradeLabel')}</span>
              <SegmentedControl
                label={t('teacher.session.gradeLabel')}
                value={form.grade}
                onChange={(grade) => setForm((prev) => ({ ...prev, grade }))}
                options={GRADES.map((grade) => ({
                  value: grade,
                  label: t(`recitation.result.${grade}`),
                }))}
              />
            </div>

            <Field label={t('teacher.session.notesLabel')} optional>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
              />
            </Field>

            <Button
              type="submit"
              size="lg"
              status={status}
              loadingText={t('common.saving')}
              successText={t('teacher.session.saved')}
              data-testid="save-session"
            >
              {t('teacher.session.save')}
            </Button>
          </form>
        </Card>
      </DataState>

      {recent.length > 0 ? (
        <Section title={t('teacher.session.history')} id="recent-sessions">
          <ul className="stack-2">
            {recent.map((session) => (
              <li key={session.id}>
                <Card variant="flat" className="row row-3 row-wrap">
                  <div className="grow">
                    <p className="t-medium">{session.studentName}</p>
                    <p className="t-xs t-muted">
                      {session.surahName} · {formatNumber(session.fromAyah)}–
                      {formatNumber(session.toAyah)} · {formatRelative(session.createdAt, t)}
                    </p>
                  </div>
                  <Badge variant={session.mastery >= 90 ? 'success' : 'info'}>
                    {formatPercent(session.mastery)}
                  </Badge>
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
