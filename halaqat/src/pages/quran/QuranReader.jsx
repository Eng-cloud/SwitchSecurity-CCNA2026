import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLE_HOME } from '../../config/navigation.js';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as quranService from '../../services/quranService.js';
import { setOffline, isOffline } from '../../mock/api.js';
import { formatNumber } from '../../lib/format.js';
import {
  PageHeader,
  Button,
  IconButton,
  Card,
  Badge,
  Alert,
  Modal,
  Drawer,
  DataState,
  ProgressBar,
  Select,
} from '../../components/ui/index.js';
import AudioPlayer from '../../components/media/AudioPlayer.jsx';
import { SURAHS, RECITERS } from '../../services/quranService.js';

const FONT_SIZES = ['sm', 'md', 'lg', 'xl'];

/** قارئ المصحف — قراءة مريحة، تكبير، علامات، تفسير، تلاوة، وتحميل دون اتصال. */
export default function QuranReader() {
  const t = useT();
  const { surahNumber } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const toast = useToast();
  // العلامات وآخر موضع والتسميع خاصة بالطالب؛ بقية الأدوار تقرأ فقط.
  const isStudent = role === 'student' && Boolean(user?.studentId);

  const [prefs, setPrefs] = useState(() => quranService.getReaderPrefs());
  const [activeAyah, setActiveAyah] = useState(null);
  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [downloadPercent, setDownloadPercent] = useState(null);
  const [offlineList, setOfflineList] = useState(() => quranService.getOfflineSurahs());
  const [offlineMode, setOfflineMode] = useState(isOffline());

  const number = Number(surahNumber);

  const fetcher = useCallback(() => quranService.getSurahContent(number), [number]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [number]);

  const bookmarksFetcher = useCallback(
    () => quranService.getBookmarks(user.studentId),
    [user.studentId],
  );
  const { data: bookmarkData } = useAsyncData(bookmarksFetcher, [user.studentId], {
    enabled: isStudent,
  });

  useEffect(() => {
    if (bookmarkData) setBookmarks(bookmarkData);
  }, [bookmarkData]);

  const tafsirFetcher = useCallback(
    () => quranService.getTafsir(number, activeAyah),
    [number, activeAyah],
  );
  const { data: tafsir, loading: tafsirLoading } = useAsyncData(tafsirFetcher, [number, activeAyah], {
    enabled: tafsirOpen && activeAyah != null,
  });

  const updatePrefs = (changes) => setPrefs(quranService.saveReaderPrefs(changes));

  const changeFont = (direction) => {
    const index = FONT_SIZES.indexOf(prefs.fontSize);
    const next = FONT_SIZES[Math.min(FONT_SIZES.length - 1, Math.max(0, index + direction))];
    updatePrefs({ fontSize: next });
  };

  const isBookmarked = (ayahNumber) =>
    bookmarks.some((item) => item.surahNumber === number && item.ayahNumber === ayahNumber);

  const handleBookmark = async (ayahNumber) => {
    const result = await quranService.toggleBookmark(user.studentId, {
      surahNumber: number,
      ayahNumber,
    });
    const refreshed = await quranService.getBookmarks(user.studentId);
    setBookmarks(refreshed);
    toast.success(result.added ? t('quran.bookmarked') : t('quran.bookmarkRemoved'));
  };

  const handleSaveLastRead = async () => {
    await quranService.saveLastRead(user.studentId, {
      surahNumber: number,
      ayahNumber: activeAyah ?? 1,
      page: data?.surah?.startPage,
    });
    toast.success(t('quran.lastReadSaved'));
  };

  const handleDownload = async () => {
    setDownloadPercent(0);
    try {
      const list = await quranService.downloadForOffline(number, setDownloadPercent);
      setOfflineList(list);
      toast.success(t('quran.offline.downloaded'));
    } finally {
      setDownloadPercent(null);
    }
  };

  const toggleOfflineMode = () => {
    const next = setOffline(!offlineMode);
    setOfflineMode(next);
    toast.info(next ? t('quran.offline.wentOffline') : t('quran.offline.backOnline'));
  };

  const isDownloaded = offlineList.includes(number);
  const surah = data?.surah;
  const prevSurah = SURAHS.find((item) => item.number === number - 1);
  const nextSurah = SURAHS.find((item) => item.number === number + 1);

  return (
    <>
      <PageHeader
        title={surah ? surah.name : t('quran.title')}
        documentTitle={surah ? surah.name : t('quran.title')}
        subtitle={
          surah
            ? `${t('quran.ayahCount', { count: formatNumber(surah.ayahCount) })} · ${t(
                `quran.${surah.revelation}`,
              )} · ${t('quran.pageNumber', { number: formatNumber(surah.startPage) })}`
            : undefined
        }
        breadcrumb={[
          { label: t('nav.home'), to: ROLE_HOME[role] ?? '/app' },
          { label: t('quran.title'), to: '/app/quran' },
          { label: surah?.name ?? '' },
        ]}
        actions={
          isStudent ? (
            <Button to={`/app/student/recitation?surah=${number}`} icon="🎙">
              {t('quran.startRecitation')}
            </Button>
          ) : null
        }
      />

      {/* شريط أدوات القارئ */}
      <div className="quran-toolbar" role="toolbar" aria-label={t('quran.title')}>
        <IconButton
          label={t('quran.decreaseFont')}
          bordered
          onClick={() => changeFont(-1)}
          disabled={prefs.fontSize === FONT_SIZES[0]}
        >
          أ−
        </IconButton>
        <IconButton
          label={t('quran.increaseFont')}
          bordered
          onClick={() => changeFont(1)}
          disabled={prefs.fontSize === FONT_SIZES[FONT_SIZES.length - 1]}
        >
          أ+
        </IconButton>

        <Button variant="ghost" size="sm" onClick={() => setAudioOpen(true)} icon="▶">
          {t('quran.recite')}
        </Button>

        {isStudent ? (
          <Button variant="ghost" size="sm" onClick={handleSaveLastRead} icon="📍">
            {t('quran.saveLastRead')}
          </Button>
        ) : null}

        <div className="row row-2 mis-auto">
          {isDownloaded ? (
            <Badge variant="success" icon="↓">
              {t('quran.offline.available')}
            </Badge>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              status={downloadPercent != null ? 'loading' : 'idle'}
              loadingText={t('quran.offline.downloading')}
            >
              {t('quran.offline.download')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={toggleOfflineMode}>
            {offlineMode ? t('quran.offline.backOnline') : t('quran.offline.simulateOffline')}
          </Button>
        </div>
      </div>

      {downloadPercent != null ? (
        <ProgressBar
          value={downloadPercent}
          label={t('quran.offline.progress', { percent: formatNumber(downloadPercent) })}
        />
      ) : null}

      <DataState loading={loading} error={error} onRetry={refetch} isEmpty={false}>
        {surah ? (
          <article className={`quran-page quran-size-${prefs.fontSize}`}>
            <header className="quran-page__head">
              <h2 className="quran-page__surah-name">{surah.name}</h2>
              <p className="t-sm t-muted">
                {t('quran.surahNumber', { number: formatNumber(surah.number) })}
              </p>
            </header>

            {surah.number !== 1 && surah.number !== 9 ? (
              <p className="quran-page__basmalah">{t('quran.basmalah')}</p>
            ) : null}

            {!data.textAvailable ? (
              <Alert variant="warning" title={t('common.notAvailable')}>
                نص هذه السورة غير متضمَّن في النسخة التجريبية. الواجهة وكل الإجراءات تعمل، والنص
                يُربط بمصدر مصحف موثّق في النسخة الحقيقية.
              </Alert>
            ) : (
              <div className="quran-text">
                {data.ayat.map((ayah) => (
                  <span
                    key={ayah.number}
                    className={`quran-ayah${activeAyah === ayah.number ? ' quran-ayah--active' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={t('quran.ayahActions', { number: formatNumber(ayah.number) })}
                    onClick={() => setActiveAyah(ayah.number)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setActiveAyah(ayah.number);
                      }
                    }}
                  >
                    {ayah.text}
                    <span className="quran-ayah__number tnum" aria-hidden="true">
                      {formatNumber(ayah.number)}
                    </span>
                  </span>
                ))}
              </div>
            )}

            <footer className="row row-between row-wrap" style={{ marginTop: 'var(--space-7)' }}>
              <Button
                variant="ghost"
                onClick={() => navigate(`/app/quran/${prevSurah.number}`)}
                disabled={!prevSurah}
              >
                → {prevSurah?.name ?? ''}
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate(`/app/quran/${nextSurah.number}`)}
                disabled={!nextSurah}
              >
                {nextSurah?.name ?? ''} ←
              </Button>
            </footer>
          </article>
        ) : null}
      </DataState>

      {/* إجراءات الآية المحددة */}
      <Modal
        open={activeAyah != null && !tafsirOpen}
        onClose={() => setActiveAyah(null)}
        title={t('quran.ayahLabel', { number: formatNumber(activeAyah ?? 0) })}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setActiveAyah(null)}>
              {t('common.close')}
            </Button>
            <Button onClick={() => setTafsirOpen(true)}>{t('quran.tafsir')}</Button>
          </>
        }
      >
        <div className="stack-3">
          <p className="t-serif t-lg" style={{ lineHeight: 2.2 }}>
            {data?.ayat?.find((item) => item.number === activeAyah)?.text ?? ''}
          </p>
          {isStudent ? (
            <Button
              variant="secondary"
              block
              onClick={() => handleBookmark(activeAyah)}
              icon={isBookmarked(activeAyah) ? '🔖' : '➕'}
            >
              {isBookmarked(activeAyah) ? t('quran.removeBookmark') : t('quran.bookmark')}
            </Button>
          ) : null}
        </div>
      </Modal>

      {/* التفسير */}
      <Drawer
        open={tafsirOpen}
        onClose={() => setTafsirOpen(false)}
        title={t('quran.tafsirTitle', { number: formatNumber(activeAyah ?? 0) })}
      >
        {tafsirLoading ? (
          <p className="t-muted">{t('common.loading')}</p>
        ) : (
          <div className="stack-4">
            <Card variant="quiet">
              <p className="t-serif" style={{ lineHeight: 2.2 }}>
                {data?.ayat?.find((item) => item.number === activeAyah)?.text ?? ''}
              </p>
            </Card>
            <p>{tafsir?.body}</p>
            <Alert variant="mock">{t('quran.tafsirNote')}</Alert>
          </div>
        )}
      </Drawer>

      {/* التلاوة */}
      <Modal
        open={audioOpen}
        onClose={() => setAudioOpen(false)}
        title={t('quran.recite')}
        description={surah?.name}
      >
        <div className="stack-4">
          <label className="field">
            <span className="field__label">{t('quran.reciterLabel')}</span>
            <Select
              value={prefs.reciter}
              onChange={(event) => updatePrefs({ reciter: event.target.value })}
            >
              {RECITERS.map((reciter) => (
                <option key={reciter.id} value={reciter.id}>
                  {reciter.name}
                </option>
              ))}
            </Select>
          </label>

          <AudioPlayer
            trackLabel={surah?.name ?? ''}
            reciterName={RECITERS.find((item) => item.id === prefs.reciter)?.name}
          />
        </div>
      </Modal>
    </>
  );
}
