import { useCallback, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as coverageService from '../../services/coverageService.js';
import { formatNumber, formatPercent, formatShortDate } from '../../lib/format.js';
import {
  PageHeader,
  Stat,
  Card,
  Table,
  Badge,
  Button,
  Field,
  Select,
  SegmentedControl,
  Modal,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';
import ReportShell from '../../components/reports/ReportShell.jsx';
import { exportColumns } from '../../lib/export.js';

const DAY_VARIANT = { present: 'success', absent: 'danger', excused: 'info' };

/**
 * تقرير حضور المعلمين — ما يُقرأ في آخر الشهر لا في أثنائه.
 *
 * الأرقام وحدها لا تكفي جوابًا عن «متى غاب؟»، فلكل معلم تفصيلٌ يُفتح على
 * أيام شهره مؤرَّخةً بحالتها. والترتيب بالأكثر غيابًا: التقرير يُقرأ لمن
 * يحتاج متابعة لا لمن انضبط.
 */
export default function TeacherAttendanceReport() {
  const t = useT();
  const { role, user } = useAuth();
  const { values, setValue } = useListState({
    defaults: { month: 'current', city: 'all', district: 'all', mosque: 'all' },
  });
  const [detail, setDetail] = useState(null);

  const fetcher = useCallback(
    () =>
      coverageService.getTeacherAttendanceReport({
        role,
        userId: user?.userId,
        month: values.month,
        city: values.city,
        district: values.district,
        mosque: values.mosque,
      }),
    [role, user?.userId, values.month, values.city, values.district, values.mosque],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [
    role,
    user?.userId,
    values.month,
    values.city,
    values.district,
    values.mosque,
  ]);

  const columns = [
    { key: 'teacherName', header: t('nav.teachers') },
    { key: 'circleName', header: t('nav.circle') },
    {
      key: 'location',
      header: t('coverage.location'),
      render: (row) => [row.city, row.district, row.mosque].filter(Boolean).join(' · ') || '—',
    },
    {
      key: 'present',
      header: t('teacher.attendanceStatus.present'),
      render: (row) => formatNumber(row.present),
    },
    {
      key: 'absent',
      header: t('teacher.attendanceStatus.absent'),
      render: (row) => (
        <Badge variant={row.absent > 0 ? 'danger' : 'neutral'}>{formatNumber(row.absent)}</Badge>
      ),
    },
    {
      key: 'excused',
      header: t('teacher.attendanceStatus.excused'),
      render: (row) => formatNumber(row.excused),
    },
    {
      key: 'attendanceRate',
      header: t('reports.attendanceRate'),
      render: (row) => formatPercent(row.attendanceRate),
    },
    {
      key: 'actions',
      header: t('teacher.tableActions'),
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          data-testid={`open-days-${row.teacherId}`}
          onClick={() => setDetail(row)}
        >
          {t('teacherAttendance.showDays')}
        </Button>
      ),
    },
  ];

  const filterField = (key, label, options) => (
    <Field label={label}>
      <Select
        value={values[key]}
        data-testid={`report-${key}`}
        onChange={(event) => setValue(key, event.target.value)}
      >
        <option value="all">{t('common.all')}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <>
      <PageHeader
        title={t('teacherAttendance.title')}
        documentTitle={t('teacherAttendance.title')}
        subtitle={t('teacherAttendance.subtitle')}
        breadcrumb={[
          { label: t('nav.home'), to: `/app/${role}` },
          { label: t('reports.title'), to: `/app/${role}/reports` },
          { label: t('teacherAttendance.title') },
        ]}
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={false}
        loadingFallback={<PageSkeleton />}
      >
        {data ? (
          <ReportShell
            title={t('teacherAttendance.title')}
            preparedBy={user.name}
            filters={
              <>
                <div className="stack-2">
                  <span className="field__label">{t('teacherAttendance.month')}</span>
                  <SegmentedControl
                    label={t('teacherAttendance.month')}
                    value={values.month}
                    onChange={(month) => setValue('month', month)}
                    options={[
                      { value: 'current', label: t('teacherAttendance.currentMonth') },
                      { value: 'previous', label: t('teacherAttendance.previousMonth') },
                    ]}
                  />
                </div>
                {filterField('city', t('coverage.city'), data.options.cities)}
                {filterField('district', t('coverage.district'), data.options.districts)}
                {filterField('mosque', t('coverage.mosque'), data.options.mosques)}
              </>
            }
            exportData={{
              filename: `halaqat-teacher-attendance-${data.monthKey}`,
              title: t('teacherAttendance.title'),
              meta: `${data.monthKey} · ${formatNumber(data.days)} ${t('teacherAttendance.days')}`,
              columns: [
                ...exportColumns(columns),
                // التواريخ تُصدَّر مسرودة: من سأل «متى؟» وجد الجواب في الملف.
                { key: 'absentList', header: t('teacherAttendance.absentDates') },
                { key: 'excusedList', header: t('teacherAttendance.excusedDates') },
              ],
              rows: data.rows.map((row) => ({
                ...row,
                location: [row.city, row.district, row.mosque].filter(Boolean).join(' · '),
                absentList: row.absentDates.join('، '),
                excusedList: row.excusedDates.join('، '),
              })),
            }}
          >
            <div className="grid grid-4 stagger">
              <Stat
                label={t('teacherAttendance.teachers')}
                value={formatNumber(data.totals.teachers)}
                icon="🧑‍🏫"
              />
              <Stat
                label={t('teacherAttendance.absentDays')}
                value={formatNumber(data.totals.absent)}
                icon="✕"
              />
              <Stat
                label={t('teacherAttendance.excusedDays')}
                value={formatNumber(data.totals.excused)}
                icon="i"
              />
              <Stat
                label={t('teacherAttendance.workDays')}
                value={formatNumber(data.days)}
                icon="📅"
              />
            </div>

            <Card>
              <Table
                columns={columns}
                rows={data.rows}
                getRowKey={(row) => row.teacherId}
                caption={t('teacherAttendance.title')}
              />
            </Card>
          </ReportShell>
        ) : null}
      </DataState>

      {/* التفصيل اليومي: جواب «متى؟» بالتاريخ لا بالرقم */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={t('teacherAttendance.daysTitle', { name: detail?.teacherName ?? '' })}
        description={detail ? `${detail.circleName} · ${data?.monthKey ?? ''}` : undefined}
        footer={
          <Button variant="ghost" onClick={() => setDetail(null)}>
            {t('common.close')}
          </Button>
        }
      >
        <ol className="day-log" data-testid="day-log">
          {(detail?.days ?? []).map((day) => (
            <li key={day.date} className="day-log__item">
              <span className="day-log__date">{formatShortDate(day.date)}</span>
              <Badge variant={DAY_VARIANT[day.status]}>
                {t(`teacher.attendanceStatus.${day.status}`)}
              </Badge>
              {day.note ? <span className="t-xs t-muted">{day.note}</span> : null}
            </li>
          ))}
        </ol>
      </Modal>
    </>
  );
}
