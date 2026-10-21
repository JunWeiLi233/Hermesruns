import { useEffect, useRef, useState } from 'react';
import { apiJson } from '../api';

const MONTH_OPTIONS = [1, 3, 6, 12];
const REQUEST_TIMEOUT_MS = 12000;

/**
 * The runner's plan. Everything is free; Supporter is paid in advance for whole months and never
 * renews, so there is nothing to cancel. The price comes from the server's billing config, and the
 * payment page (Stripe) shows the total before anything is charged.
 */
export default function SettingsPlanCard({ t }) {
  const [plan, setPlan] = useState({ state: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const scopeRef = useRef(null);
  const checkoutRef = useRef(null);
  const monthLabels = {
    1: t('settings.plan_months_1'),
    3: t('settings.plan_months_3'),
    6: t('settings.plan_months_6'),
    12: t('settings.plan_months_12'),
  };

  useEffect(() => {
    scopeRef.current = {};
    return () => {
      scopeRef.current = null;
      const checkout = checkoutRef.current;
      if (checkout) {
        window.clearTimeout(checkout.timeoutId);
        checkout.controller.abort();
        checkoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setPlan({ state: 'loading' });
    const timeoutId = window.setTimeout(() => {
      cancelled = true;
      controller.abort();
      setPlan({ state: 'error' });
    }, REQUEST_TIMEOUT_MS);
    Promise.all([
      apiJson('/api/profile/quota', { signal: controller.signal }),
      apiJson('/api/billing/config', { signal: controller.signal }),
    ]).then(([quota, billing]) => {
      if (cancelled) return;
      if (typeof quota?.pro !== 'boolean' || typeof billing?.configured !== 'boolean') {
        throw new Error('Invalid plan response');
      }
      setPlan({
        state: 'ready',
        supporter: quota.pro,
        open: billing.configured,
        priceLabel: typeof billing?.priceLabel === 'string' ? billing.priceLabel : '',
      });
    }).catch(() => {
      if (!cancelled) setPlan({ state: 'error' });
      controller.abort();
    }).finally(() => {
      window.clearTimeout(timeoutId);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadAttempt]);

  async function startCheckout() {
    const scope = scopeRef.current;
    if (!scope || checkoutRef.current || plan.state !== 'ready' || !plan.open) return;
    const checkout = { controller: new AbortController(), pathname: window.location.pathname, timeoutId: null };
    checkoutRef.current = checkout;
    const stillHere = () => scopeRef.current === scope && checkoutRef.current === checkout
      && window.location.pathname === checkout.pathname;
    checkout.timeoutId = window.setTimeout(() => {
      if (stillHere()) {
        setMessage(t('settings.plan_checkout_error'));
        setBusy(false);
        checkoutRef.current = null;
      }
      checkout.controller.abort();
    }, REQUEST_TIMEOUT_MS);
    setBusy(true);
    setMessage('');
    let opened = false;
    try {
      const body = await apiJson('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months }),
        signal: checkout.controller.signal,
      });
      if (!stillHere()) return;
      if (body && typeof body.url === 'string' && body.url) {
        window.location.assign(body.url);
        opened = true;
        return;
      }
      setMessage(t('settings.plan_checkout_error'));
    } catch {
      if (stillHere()) setMessage(t('settings.plan_checkout_error'));
    } finally {
      window.clearTimeout(checkout.timeoutId);
      if (stillHere() && !opened) {
        checkoutRef.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <>
      <h3 className="st-v2-group-label st-v2-subgroup-label">{t('settings.plan_group_title')}</h3>
      <div className="st-v2-card" data-plan={plan.state !== 'ready' ? plan.state : plan.supporter ? 'supporter' : 'free'} aria-busy={plan.state === 'loading' || busy}>
        <div className="st-v2-row">
          <div className="st-v2-row-copy">
            <strong>{plan.state !== 'ready' ? t('settings.plan_group_title') : plan.supporter ? t('settings.plan_supporter_title') : t('settings.plan_free_title')}</strong>
            {plan.state === 'loading' ? <span role="status">{t('settings.plan_loading')}</span> : plan.state === 'error' ? (
              <span role="alert">{t('settings.plan_load_error')}</span>
            ) : <span>{plan.supporter ? t('settings.plan_supporter_active') : t('settings.plan_free_copy')}</span>}
          </div>
          {plan.state === 'error' ? (
            <button type="button" className="st-v2-btn" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
              {t('settings.training_retry')}
            </button>
          ) : null}
        </div>
        {plan.state !== 'ready' ? null : (
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
