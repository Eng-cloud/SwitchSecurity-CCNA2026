import { useCallback, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as tajweedService from '../../services/tajweedService.js';
import { formatShortDate } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Select,
  Field,
  Input,
  Textarea,
  Modal,
  ConfirmDialog,
  SearchInput,
  DataState,
  PageSkeleton,
  Alert,
} from '../../components/ui/index.js';

const EMPTY = { ruleId: '', kind: 'clip', title: '', url: '', description: '' };

/**
 * قسم التجويد — مرجعٌ يُقرأ لا لوحة تُدار.
 *
 * الأحكام أولًا لأنها المتن، ثم المقاطع والروابط لأنها الشرح. والإضافة
 * لا تظهر إلا لمن يملكها فعلًا: الإدارة العليا. غيرها يرى القسم كاملًا
 * بلا أزرارٍ لا تعمل — فالزرّ الذي لا يفعل شيئًا كذبٌ صغير.
 */
export default function Tajweed() {
  const t = useT();
  const { role, user } = useAuth();
  const toast = useToast();

  const [categoryId, setCategoryId] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [removing, setRemoving] = useState(null);
  const [status, setStatus] = useState('idle');

  const fetcher = useCallback(
    () => tajweedService.getLibrary({ role, userId: user?.userId, categoryId, query }),
    [role, user?.userId, categoryId, query],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [
    role,
    user?.userId,
    categoryId,
    query,
  ]);

  const run = async (action, successKey) => {
    setStatus('loading');
    try {
      await action();
      toast.success(t(successKey));
      await refetch();
      return true;
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
      return false;
    } finally {
      setStatus('idle');
    }
  };

  const openAdd = () => {
    setForm({ ...EMPTY, ruleId: data?.rules?.[0]?.id ?? '' });
    setEditing('new');
  };

  const openEdit = (item) => {
    setForm({
      ruleId: item.ruleId,
      kind: item.kind,
      title: item.title,
      url: item.url,
      description: item.description ?? '',
    });
    setEditing(item.id);
  };

  const submit = async (event) => {
    event.preventDefault();
    const payload = { role, userId: user?.userId, userName: user?.name, ...form };
    const ok = await run(
      () =>
        editing === 'new'
          ? tajweedService.addItem(payload)
          : tajweedService.updateItem({ ...payload, itemId: editing }),
      editing === 'new' ? 'tajweed.added' : 'tajweed.updated',
    );
    if (ok) {
      setEditing(null);
      setForm(EMPTY);
    }
  };

  const mayManage = Boolean(data?.mayManage);

  return (
    <>
      <PageHeader
        title={t('tajweed.title')}
        documentTitle={t('tajweed.title')}
        subtitle={t('tajweed.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: `/app/${role}` }, { label: t('tajweed.title') }]}
        actions={
          mayManage ? (
            <Button onClick={openAdd} data-testid="add-tajweed">
              {t('tajweed.add')}
            </Button>
          ) : null
        }
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={false}
        loadingFallback={<PageSkeleton />}
      >
        {data ? (
          <div className="stack-6">
            {/* المتن: الأحكام نفسها */}
            <section className="stack-4">
              <h2 className="t-lg t-semibold">{t('tajweed.rulesTitle')}</h2>
              <div className="grid grid-2 stagger">
                {data.rules.map((rule) => (
                  <Card key={rule.id} className="stack-2 tajweed-rule">
                    <div className="row row-2 row-wrap">
                      <strong className="grow">{rule.name}</strong>
                      <Badge variant="brand">{rule.categoryName}</Badge>
                    </div>
                    <p className="t-sm t-muted">{rule.definition}</p>
                    <p className="t-sm">
                      <span className="t-muted">{t('tajweed.letters')}: </span>
                      {rule.letters}
                    </p>
                    <p className="tajweed-example quran-text">{rule.example}</p>
                  </Card>
                ))}
              </div>
            </section>

            {/* الشرح: ما أضافته الإدارة */}
            <section className="stack-4">
              <div className="row row-4 row-wrap">
                <h2 className="t-lg t-semibold grow">{t('tajweed.libraryTitle')}</h2>
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  label={t('search.label')}
                  placeholder={t('tajweed.searchPlaceholder')}
                />
                <Field label={t('tajweed.category')} className="shrink-0">
                  <Select
                    value={categoryId}
                    data-testid="tajweed-category"
                    onChange={(event) => setCategoryId(event.target.value)}
                  >
                    <option value="all">{t('common.all')}</option>
                    {data.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {data.items.length === 0 ? (
                <Alert variant="info" title={t('tajweed.emptyTitle')}>
                  {t(mayManage ? 'tajweed.emptyHintAdmin' : 'tajweed.emptyHint')}
                </Alert>
              ) : (
                <div className="grid grid-2 stagger">
                  {data.items.map((item) => (
                    <Card key={item.id} className="stack-3" data-testid="tajweed-item">
                      <div className="row row-2 row-wrap">
                        <Badge variant={item.kind === 'clip' ? 'info' : 'neutral'}>
                          {t(`tajweed.kind.${item.kind}`)}
                        </Badge>
                        <Badge variant="brand">{item.ruleName}</Badge>
                      </div>
                      <strong>{item.title}</strong>
                      {item.description ? (
                        <p className="t-sm t-muted">{item.description}</p>
                      ) : null}
                      <p className="t-xs t-muted">
                        {t('tajweed.addedBy', {
                          name: item.addedByName,
                          date: formatShortDate(item.createdAt),
                        })}
                      </p>
                      <div className="row row-2 row-wrap">
                        <Button
                          size="sm"
                          variant="secondary"
                          href={item.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {t(item.kind === 'clip' ? 'tajweed.play' : 'tajweed.open')}
                        </Button>
                        {mayManage ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                              {t('common.edit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              data-testid="remove-tajweed"
                              onClick={() => setRemoving(item)}
                            >
                              {t('common.delete')}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </DataState>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={t(editing === 'new' ? 'tajweed.add' : 'tajweed.edit')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="tajweed-form" status={status} data-testid="save-tajweed">
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="tajweed-form" className="stack-4" onSubmit={submit} noValidate>
          <Field label={t('tajweed.rule')} required>
            <Select
              value={form.ruleId}
              data-testid="tajweed-rule"
              onChange={(event) => setForm((prev) => ({ ...prev, ruleId: event.target.value }))}
            >
              {(data?.rules ?? []).map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('tajweed.kindLabel')} required>
            <Select
              value={form.kind}
              data-testid="tajweed-kind"
              onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value }))}
            >
              <option value="clip">{t('tajweed.kind.clip')}</option>
              <option value="link">{t('tajweed.kind.link')}</option>
            </Select>
          </Field>
          <Field label={t('tajweed.itemTitle')} required>
            <Input
              value={form.title}
              data-testid="tajweed-title"
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </Field>
          <Field label={t('tajweed.url')} required hint={t('tajweed.urlHint')}>
            <Input
              value={form.url}
              data-testid="tajweed-url"
              style={{ direction: 'ltr', textAlign: 'start' }}
              onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
            />
          </Field>
          <Field label={t('tajweed.description')} optional>
            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const ok = await run(
            () =>
              tajweedService.removeItem({ role, userId: user?.userId, itemId: removing.id }),
            'tajweed.removed',
          );
          if (ok) setRemoving(null);
        }}
        title={t('tajweed.removeTitle')}
        message={t('tajweed.removeConfirm', { title: removing?.title ?? '' })}
        variant="danger"
        status={status}
      />
    </>
  );
}
