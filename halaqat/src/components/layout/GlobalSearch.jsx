import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import useAsyncData from '../../hooks/useAsyncData.js';
import useOnClickOutside from '../../hooks/useOnClickOutside.js';
import * as searchService from '../../services/searchService.js';
import { SearchInput } from '../ui/Input.jsx';
import { Spinner } from '../ui/States.jsx';

/** بحث سريع في الشريط العلوي مع Debounce وحالات فارغة/تحميل. */
export default function GlobalSearch() {
  const t = useT();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(query, 300);
  const wrapRef = useRef(null);

  useOnClickOutside(wrapRef, () => setOpen(false), open);

  const { data, loading } = useAsyncData(
    () => searchService.search(debounced, { role }),
    [debounced, role],
    { enabled: debounced.trim().length >= 2 },
  );

  const go = (path) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  const hasResults = data && data.total > 0;

  return (
    <div className="menu__wrap" ref={wrapRef}>
      <SearchInput
        value={query}
        onChange={(value) => {
          setQuery(value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t('search.placeholder')}
        label={t('search.label')}
      />

      {open && query.trim().length > 0 ? (
        <div className="menu" role="region" aria-label={t('search.title')}>
          {query.trim().length < 2 ? (
            <p className="t-sm t-muted" style={{ padding: 'var(--space-3)' }}>
              {t('search.hint')}
            </p>
          ) : loading ? (
            <p className="row row-2 t-sm t-muted" style={{ padding: 'var(--space-3)' }}>
              <Spinner size="sm" />
              {t('search.searching')}
            </p>
          ) : !hasResults ? (
            <p className="t-sm t-muted" style={{ padding: 'var(--space-3)' }}>
              {t('search.empty')}
            </p>
          ) : (
            <div className="menu__scroll">
              {data.students.length > 0 ? (
                <>
                  <p className="palette__group-title">{t('search.groups.students')}</p>
                  {data.students.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className="menu__item"
                      onClick={() => go(`/app/${role}/students/${student.id}`)}
                    >
                      <span aria-hidden="true">🧑‍🎓</span>
                      <span className="grow">{student.name}</span>
                      <span className="t-xs t-muted">{student.circleName}</span>
                    </button>
                  ))}
                </>
              ) : null}

              {data.circles.length > 0 ? (
                <>
                  <p className="palette__group-title">{t('search.groups.circles')}</p>
                  {data.circles.map((circle) => (
                    <button
                      key={circle.id}
                      type="button"
                      className="menu__item"
                      onClick={() =>
                        go(
                          role === 'admin'
                            ? '/app/admin/circles'
                            : `/app/supervisor/circles/${circle.id}`,
                        )
                      }
                    >
                      <span aria-hidden="true">🕌</span>
                      {circle.name}
                    </button>
                  ))}
                </>
              ) : null}

              {data.surahs.length > 0 ? (
                <>
                  <p className="palette__group-title">{t('search.groups.surahs')}</p>
                  {data.surahs.map((surah) => (
                    <button
                      key={surah.number}
                      type="button"
                      className="menu__item"
                      onClick={() => go(`/app/student/quran/${surah.number}`)}
                    >
                      <span aria-hidden="true">📖</span>
                      {surah.name}
                    </button>
                  ))}
                </>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
