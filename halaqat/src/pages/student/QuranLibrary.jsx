import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import useListState from '../../hooks/useListState.js';
import * as quranService from '../../services/quranService.js';
import { formatNumber } from '../../lib/format.js';
import {
  PageHeader,
  Tabs,
  SearchInput,
  Card,
  Badge,
  DataState,
  EmptyState,
  Button,
  Skeleton,
} from '../../components/ui/index.js';

/** مكتبة المصحف: السور، الأجزاء، العلامات، وآخر موضع. */
export default function QuranLibrary() {
  const t = useT();
  const { user } = useAuth();
  const { values, setValue } = useListState({ defaults: { tab: 'surahs', q: '' } });
  const query = values.q;
  const debouncedQuery = useDebouncedValue(query, 250);

  const surahsFetcher = useCallback(
    () => quranService.listSurahs({ query: debouncedQuery }),
    [debouncedQuery],
  );
  const { data: surahs, loading, error, refetch } = useAsyncData(surahsFetcher, [debouncedQuery]);

  const juzFetcher = useCallback(() => quranService.listJuz(), []);
  const { data: juzList } = useAsyncData(juzFetcher, [], { enabled: values.tab === 'juzs' });

  const bookmarksFetcher = useCallback(
    () => quranService.getBookmarks(user.studentId),
    [user.studentId],
  );
  const { data: bookmarks, refetch: refetchBookmarks } = useAsyncData(bookmarksFetcher, [], {
    enabled: values.tab === 'bookmarks',
  });

  const [lastRead] = useState(() => quranService.getLastRead(user.studentId));
  const offlineSurahs = quranService.getOfflineSurahs();

  const tabs = [
    { value: 'surahs', label: t('quran.surahs') },
    { value: 'juzs', label: t('quran.juzs') },
    { value: 'bookmarks', label: t('quran.bookmarks') },
  ];

  return (
    <>
      <PageHeader
        title={t('quran.title')}
        subtitle={t('quran.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/student' }, { label: t('quran.title') }]}
      />

      {lastRead ? (
        <Card className="row row-between row-wrap" variant="quiet">
          <div>
            <p className="t-sm t-muted">{t('quran.lastRead')}</p>
            <p className="t-lg t-semibold t-serif">
              {lastRead.surahName} · {t('quran.ayahLabel', { number: formatNumber(lastRead.ayahNumber) })}
            </p>
          </div>
          <Button to={`/app/student/quran/${lastRead.surahNumber}`}>
            {t('student.resumeReading')}
          </Button>
        </Card>
      ) : null}

      <Tabs tabs={tabs} value={values.tab} onChange={(tab) => setValue('tab', tab)} label={t('quran.title')}>
        {values.tab === 'surahs' ? (
          <div className="stack-5">
            <SearchInput
              value={query}
              onChange={(value) => setValue('q', value)}
              placeholder={t('quran.searchPlaceholder')}
              label={t('quran.searchPlaceholder')}
            />

            <DataState
              loading={loading}
              error={error}
              onRetry={refetch}
              isEmpty={surahs?.length === 0}
              emptyTitle={t('state.emptySearchTitle')}
              emptyText={t('state.emptySearchHint')}
              loadingFallback={
                <div className="grid grid-3">
                  {Array.from({ length: 9 }, (_, index) => (
                    <Skeleton key={index} variant="card" height={72} />
                  ))}
                </div>
              }
            >
              <ul className="grid grid-3">
                {(surahs ?? []).map((surah) => (
                  <li key={surah.number}>
                    <Link
                      to={`/app/student/quran/${surah.number}`}
                      className="surah-card"
                      aria-label={t('quran.openSurah', { name: surah.name })}
                    >
                      <span className="surah-card__number tnum" aria-hidden="true">
                        {formatNumber(surah.number)}
                      </span>
                      <span className="grow">
                        <span className="surah-card__name">{surah.name}</span>
                        <span className="t-xs t-muted" style={{ display: 'block' }}>
                          {t('quran.ayahCount', { count: formatNumber(surah.ayahCount) })} ·{' '}
                          {t(`quran.${surah.revelation}`)}
                        </span>
                      </span>
                      {offlineSurahs.includes(surah.number) ? (
                        <Badge variant="success" icon="↓">
                          {t('quran.offline.available')}
                        </Badge>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </DataState>
          </div>
        ) : null}

        {values.tab === 'juzs' ? (
          <ul className="grid grid-3">
            {(juzList ?? []).map((juz) => (
              <li key={juz.number}>
                <Card className="row row-3">
                  <span className="surah-card__number tnum" aria-hidden="true">
                    {formatNumber(juz.number)}
                  </span>
                  <div className="grow">
                    <p className="t-medium">{t('quran.juzNumber', { number: formatNumber(juz.number) })}</p>
                    <p className="t-xs t-muted">
                      {juz.firstSurah} · {t('quran.pageNumber', { number: formatNumber(juz.startPage) })}
                    </p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}

        {values.tab === 'bookmarks' ? (
          (bookmarks ?? []).length === 0 ? (
            <EmptyState
              icon="🔖"
              title={t('quran.bookmarks')}
              text={t('quran.noBookmarks')}
              action={
                <Button variant="secondary" onClick={() => setValue('tab', 'surahs')}>
                  {t('quran.surahs')}
                </Button>
              }
            />
          ) : (
            <ul className="stack-2">
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id}>
                  <Card className="row row-between row-wrap">
                    <div>
                      <p className="t-serif t-lg">{bookmark.surahName}</p>
                      <p className="t-xs t-muted">
                        {t('quran.ayahLabel', { number: formatNumber(bookmark.ayahNumber) })}
                      </p>
                    </div>
                    <div className="row row-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        to={`/app/student/quran/${bookmark.surahNumber}`}
                      >
                        {t('common.open')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await quranService.toggleBookmark(user.studentId, {
                            surahNumber: bookmark.surahNumber,
                            ayahNumber: bookmark.ayahNumber,
                          });
                          refetchBookmarks();
                        }}
                      >
                        {t('quran.removeBookmark')}
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Tabs>
    </>
  );
}
