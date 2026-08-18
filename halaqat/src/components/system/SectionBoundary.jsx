import { Component } from 'react';
import { translate } from '../../i18n/index.jsx';

/**
 * حاجز أخطاء محلي لقسم واحد.
 *
 * الحاجز العام يمنع الشاشة البيضاء لكنه يبتلع الصفحة كلها: لو تعطّل مشغّل
 * الصوت أو رسم بياني، لا يصح أن تختفي بقية الصفحة معه. هذا الحاجز يعزل
 * العطل في بطاقته ويتيح إعادة المحاولة موضعيًا دون إعادة تحميل الصفحة.
 *
 * إعادة المحاولة تغيّر `attempt` فيُعاد بناء الشجرة الداخلية من جديد.
 */
export default class SectionBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, attempt: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env?.DEV) {
      console.error(`[SectionBoundary:${this.props.name ?? 'section'}]`, error, info);
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }));
  };

  render() {
    const { error, attempt } = this.state;
    const { children, title } = this.props;

    if (error) {
      return (
        <div className="card stack-3" role="alert">
          <p className="t-strong">{title ?? translate('state.sectionErrorTitle')}</p>
          <p className="t-sm t-secondary">{translate('state.sectionErrorHint')}</p>
          <button type="button" className="btn btn--secondary btn--sm" onClick={this.handleRetry}>
            {translate('common.retry')}
          </button>
        </div>
      );
    }

    return <div key={attempt}>{children}</div>;
  }
}
