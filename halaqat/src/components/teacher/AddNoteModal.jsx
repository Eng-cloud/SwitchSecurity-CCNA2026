import { useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as teacherService from '../../services/teacherService.js';
import { validateNote } from '../../lib/validators.js';
import { Modal, Button, Field, Select, Textarea } from '../ui/index.js';

const TYPES = ['praise', 'improvement', 'behavior', 'absence'];

/** إضافة ملاحظة على طالب — نموذج قصير مع تحقق ورسالة نجاح. */
export default function AddNoteModal({ open, onClose, student, onSaved }) {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();
  const [type, setType] = useState('praise');
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const key = validateNote(text);
    if (key) {
      setError(t(key));
      return;
    }

    setStatus('loading');
    try {
      const note = await teacherService.addNote(student.id, {
        type,
        text,
        authorId: user.userId,
      });
      setStatus('idle');
      setText('');
      setError(null);
      toast.success(t('teacher.note.saved'));
      onSaved?.(note);
      onClose();
    } catch {
      setStatus('idle');
      toast.error(t('state.errorHint'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('teacher.note.title')}
      description={student?.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            status={status}
            loadingText={t('common.saving')}
            data-testid="save-note"
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form className="stack-4" onSubmit={handleSubmit}>
        <Field label={t('teacher.note.typeLabel')}>
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            {TYPES.map((item) => (
              <option key={item} value={item}>
                {t(`teacher.note.types.${item}`)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('teacher.note.textLabel')} error={error} required>
          <Textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (error) setError(null);
            }}
            placeholder={t('teacher.note.textPlaceholder')}
            rows={4}
          />
        </Field>
      </form>
    </Modal>
  );
}
