import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import * as searchService from '../../services/searchService.js';
import { formatNumber } from '../../lib/format.js';
import {
  PageHeader,
  SearchInput,
  Card,
  Section,
  EmptyState,
  LoadingState,
  ErrorState,
  Badge,
} from '../../components/ui/index.js';

/** صفحة بحث كاملة — مكمّلة للبحث السريع في الشريط العلوي. */
export default function SearchPage() {
  const t = useT();
  const { role, user } = useAuth();
  const { values, setValue } = useListState({ defaults: { q: '' } });
  const query = values.q;
  const debounced = useDebouncedValue(query, 300);

  const fetcher = useCallback(
    () =>
      searchService.search(debounced, {
        role,
        limit: 12,
        userId: user?.userId,
        circleId: user?.circleId,
        childrenIds: user?.childrenIds ?? [],
      }),
    [debounced, role, user],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [debounced, role], {
    enabled: debounced.trim().length >= 2,
  });

  const showHint = query.trim().length < 2;

  return (
    <>
      <PageHeader
        title={t('search.title')}
        breadcrumb={[{ label: t('nav.home'), to: '/app' }, { label: t('search.title') }]}
      />

      <SearchInput
        value={query}
        onChange={(value) => setValue('q', value)}
        placeholder={t('search.placeholder')}
        label={t('search.label')}
        autoFocus
      />

      {showHint ? (
        <EmptyState icon="🔍" title={t('search.title')} text={t('search.hint')} />
      ) : loading ? (
        <LoadingState text={t('search.searching')} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data || data.total === 0 ? (
        <EmptyState title={t('state.emptySearchTitle')} text={t('search.empty')} />
      ) : (
        <div className="stack-6">
          <p className="t-sm t-muted" aria-live="polite">
            {t('search.resultsFor', { query })} · {t('common.resultsCount', { count: formatNumber(data.total) })}
          </p>

          {data.students.length > 0 ? (
            <Section title={t('search.groups.students')} id="results-students">
              <ul className="grid grid-3">
                {data.students.map((student) => (
                  <li key={student.id}>
                    <Card className="row row-3">
                      <span aria-hidden="true">🧑‍🎓</span>
                      <div className="grow">
                        <Link
                          to={
                            role === 'parent'
                              ? `/app/parent/children/${student.id}`
                              : `/app/${role}/students/${student.id}`
                          }
                          className="t-medium"
                        >
                          {student.name}
                        </Link>
                        <p className="t-xs t-muted">{student.circleName}</p>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {data.circles.length > 0 ? (
            <Section title={t('search.groups.circles')} id="results-circles">
              <ul className="grid grid-3">
                {data.circles.map((circle) => (
                  <li key={circle.id}>
                    <Card className="row row-3">
                      <span aria-hidden="true">🕌</span>
                      <Link
                        to={
                          role === 'admin'
                            ? '/app/admin/circles'
                            : `/app/supervisor/circles/${circle.id}`
                        }
                        className="t-medium grow"
                      >
                        {circle.name}
                      </Link>
                    </Card>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {data.surahs.length > 0 ? (
            <Section title={t('search.groups.surahs')} id="results-surahs">
              <ul className="grid grid-3">
                {data.surahs.map((surah) => (
                  <li key={surah.number}>
                    <Card className="row row-3">
                      <span aria-hidden="true">📖</span>
                      <div className="grow">
                        <Link to={`/app/quran/${surah.number}`} className="t-medium t-serif">
                          {surah.name}
                        </Link>
                        <p className="t-xs t-muted">
                          {t('quran.ayahCount', { count: formatNumber(surah.ayahCount) })}
                        </p>
                      </div>
                      <Badge variant="neutral">{formatNumber(surah.number)}</Badge>
                    </Card>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      )}
    </>
  );
}
