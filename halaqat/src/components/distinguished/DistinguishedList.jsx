import { useT } from '../../i18n/index.jsx';
import { formatPercent, formatNumber } from '../../lib/format.js';
import { Card, Badge, Button, EmptyState } from '../ui/index.js';

/**
 * قائمة متميزي الشهر — يستخدمها المعلم لحلقته والمشرف لحلقاته.
 *
 * تُعرض المعايير الثلاثة بجانب كل اسم لا مؤشرًا واحدًا غامضًا، فيفهم القارئ
 * لماذا تقدّم هذا على ذاك ولا يبقى الترتيب حكمًا بلا سبب.
 */
export default function DistinguishedList({ rows, showCircle = false, profileBase, action }) {
  const t = useT();

  if (!rows?.length) {
    return (
      <Card variant="quiet">
        <p className="t-muted">{t('distinguished.circleEmpty')}</p>
      </Card>
    );
  }

  return (
    <ol className="distinguished-list">
      {rows.map((row, index) => (
        <li key={row.id} data-testid="distinguished-row">
          <span className="distinguished-list__rank" aria-label={t('distinguished.rank')}>
            {formatNumber(index + 1)}
          </span>

          <div className="distinguished-list__body">
            <p className="t-strong">
              {row.name}{' '}
              {row.isAssistant ? (
                <Badge variant="success" icon="★">
                  {t('teacher.assistant.badge')}
                </Badge>
              ) : null}
            </p>

            <p className="t-sm t-muted">
              {showCircle ? `${row.circleName} · ` : ''}
              {t('distinguished.monthMastery')}: {formatPercent(row.mastery)} ·{' '}
              {t('distinguished.monthAttendance')}: {formatPercent(row.attendanceRate)} ·{' '}
              {t('distinguished.monthSessions')}: {formatNumber(row.sessionsCount)}
            </p>

            {row.reviewedByAssistant > 0 ? (
              <p className="t-sm t-muted">
                {t('distinguished.byAssistant', { count: formatNumber(row.reviewedByAssistant) })}
              </p>
            ) : null}
          </div>

          <div className="distinguished-list__actions">
            {action ? action(row) : null}
            {profileBase ? (
              <Button size="sm" variant="ghost" to={`${profileBase}/${row.id}`}>
                {t('distinguished.viewStudent')}
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** حالة «لا متميز» على مستوى الصفحة، مع تفسير سببها المحتمل. */
export function DistinguishedEmpty({ onPrevious }) {
  const t = useT();
  return (
    <EmptyState
      icon="🌙"
      title={t('distinguished.empty')}
      text={t('distinguished.emptyHint')}
      action={
        onPrevious ? (
          <Button variant="secondary" onClick={onPrevious}>
            {t('distinguished.monthPrevious')}
          </Button>
        ) : null
      }
    />
  );
}
