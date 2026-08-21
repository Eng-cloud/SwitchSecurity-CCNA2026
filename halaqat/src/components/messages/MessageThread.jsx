import { useCallback, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as messageService from '../../services/messageService.js';
import { formatDateTime } from '../../lib/format.js';
import { Card, Button, Field, Textarea, DataState, Skeleton, Alert } from '../ui/index.js';

/**
 * محادثة ولي الأمر ومعلّم ابنه.
 *
 * طرفان اثنان ومحادثة واحدة لكل طالب، فلا حاجة لقوائم ولا لعناوين: تُفتح
 * من صفحة الابن عند وليّه ومن ملفّه عند معلّمه، وهي هي.
 */
export default function MessageThread({ studentId }) {
  const t = useT();
  const { role, user } = useAuth();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('idle');

  const fetcher = useCallback(
    () => messageService.getThread({ role, userId: user?.userId, studentId }),
    [role, user?.userId, studentId],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [role, user?.userId, studentId]);

  const send = async (event) => {
    event.preventDefault();
    if (body.trim().length < 2) return;

    setStatus('loading');
    try {
      await messageService.sendMessage({
        role,
        userId: user?.userId,
        userName: user?.name,
        studentId,
        body,
      });
      setBody('');
      toast.success(t('messages.sent'));
      await refetch();
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
    } finally {
      setStatus('idle');
    }
  };

  return (
    <Card className="stack-4" data-testid="message-thread">
      <div>
        <h2 className="t-lg t-semibold">{t('messages.title')}</h2>
        {data?.counterpart ? (
          <p className="t-sm t-muted">{t('messages.with', { name: data.counterpart })}</p>
        ) : null}
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={false}
        loadingFallback={<Skeleton variant="card" count={2} height={56} />}
      >
        {data?.messages?.length === 0 ? (
          <Alert variant="info" title={t('messages.emptyTitle')}>
            {t('messages.emptyHint')}
          </Alert>
        ) : (
          <ol className="thread" data-testid="thread-list">
            {(data?.messages ?? []).map((message) => (
              <li
                key={message.id}
                className={`thread__item${message.mine ? ' thread__item--mine' : ''}`}
              >
                <div className="thread__bubble">
                  <p className="thread__body">{message.body}</p>
                  <p className="thread__meta">
                    {message.authorName} · {formatDateTime(message.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </DataState>

      <form className="stack-3" onSubmit={send} noValidate>
        <Field label={t('messages.write')}>
          <Textarea
            value={body}
            rows={3}
            data-testid="message-body"
            placeholder={t('messages.placeholder')}
            onChange={(event) => setBody(event.target.value)}
          />
        </Field>
        <div className="row row-end">
          <Button
            type="submit"
            status={status}
            disabled={body.trim().length < 2}
            data-testid="send-message"
          >
            {t('messages.send')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
