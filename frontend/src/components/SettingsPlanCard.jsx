import { useEffect, useState } from 'react';
import { apiJson } from '../api';

const MONTH_OPTIONS = [1, 3, 6, 12];

/**
 * The runner's plan. Everything is free; Supporter is paid in advance for whole months and never
 * renews, so there is nothing to cancel. The price comes from the server's billing config, and the
 * payment page (Stripe) shows the total before anything is charged.
 */
export default function SettingsPlanCard({ t }) {
  const [plan, setPlan] = useState({ loading: true, supporter: false, open: false, priceLabel: '' });
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const monthLabels = {
    1: t('settings.plan_months_1'),
    3: t('settings.plan_months_3'),
    6: t('settings.plan_months_6'),
    12: t('settings.plan_months_12'),
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiJson('/api/profile/quota').catch(() => null),
      apiJson('/api/billing/config').catch(() => null),
    ]).then(([quota, billing]) => {
      if (cancelled) return;
      setPlan({
        loading: false,
        supporter: Boolean(quota?.pro),
        open: Boolean(billing?.configured),
        priceLabel: typeof billing?.priceLabel === 'string' ? billing.priceLabel : '',
      });
    });
    return () => { cancelled = true; };
  }, []);

  async function startCheckout() {
    setBusy(true);
    setMessage('');
    try {
      const body = await apiJson('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months }),
      });
      if (body && typeof body.url === 'string' && body.url) {
        window.location.assign(body.url);
        return;
      }
      setMessage(t('settings.plan_checkout_error'));
    } catch {
      setMessage(t('settings.plan_checkout_error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h3 className="st-v2-group-label st-v2-subgroup-label">{t('settings.plan_group_title')}</h3>
      <div className="st-v2-card" data-plan={plan.loading ? 'loading' : plan.supporter ? 'supporter' : 'free'}>
        <div className="st-v2-row">
          <div className="st-v2-row-copy">
            <strong>{plan.supporter ? t('settings.plan_supporter_title') : t('settings.plan_free_title')}</strong>
            <span>{plan.loading ? t('settings.plan_loading') : plan.supporter ? t('settings.plan_supporter_active') : t('settings.plan_free_copy')}</span>
          </div>
        </div>
        {plan.loading ? null : (
          <div className="st-v2-row">
            <div className="st-v2-row-copy">
              <strong>{plan.supporter ? t('settings.plan_extend_title') : t('settings.plan_supporter_title')}</strong>
              <span>{t('settings.plan_supporter_copy')}</span>
              {plan.open ? (
                <>
                  <span>{plan.priceLabel ? t('settings.plan_price', { price: plan.priceLabel }) : t('settings.plan_price_on_page')}</span>
                  <label className="st-v2-option">
                    {t('settings.plan_months_label')}
                    <select value={months} disabled={busy} onChange={(event) => setMonths(Number(event.target.value))}>
                      {MONTH_OPTIONS.map((option) => (
                        <option key={option} value={option}>{monthLabels[option]}</option>
                      ))}
                    </select>
                  </label>
                  <span>{t('settings.plan_no_renewal')}</span>
                </>
              ) : (
                <span>{t('settings.plan_closed')}</span>
              )}
              {message ? <span role="alert">{message}</span> : null}
            </div>
            {plan.open ? (
              <button type="button" className="st-v2-btn" onClick={startCheckout} disabled={busy}>
                {busy ? t('settings.plan_opening') : t('settings.plan_buy_button')}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
