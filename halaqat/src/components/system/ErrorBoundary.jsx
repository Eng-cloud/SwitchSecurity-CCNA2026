import { Component } from 'react';
import { translate } from '../../i18n/index.jsx';

/**
 * حاجز أخطاء عام — يمنع الشاشة البيضاء عند أي خطأ غير متوقع
 * ويعرض رسالة عربية واضحة مع إمكانية إعادة التحميل.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // في تطبيق حقيقي يُرسل إلى خدمة تتبع الأخطاء.
    if (import.meta.env?.DEV) {
      console.error('[ErrorBoundary]', error, info);
    }
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '60dvh',
          display: 'grid',
          placeItems: 'center',
          padding: 'var(--space-7)',
        }}
      >
        <div className="card stack-4" style={{ maxWidth: '520px', textAlign: 'center' }}>
          <h1 className="t-xl t-semibold">{translate('state.crashTitle')}</h1>
          <p className="t-secondary">{translate('state.crashHint')}</p>
          <pre
            className="t-xs t-muted"
            style={{
              whiteSpace: 'pre-wrap',
              background: 'var(--surface-2)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'start',
              direction: 'ltr',
              overflowX: 'auto',
            }}
          >
            {String(error?.message ?? error)}
          </pre>
          <button type="button" className="btn btn--primary" onClick={this.handleReload}>
            {translate('state.reload')}
          </button>
        </div>
      </div>
    );
  }
}
