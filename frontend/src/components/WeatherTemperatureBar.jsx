import { useEffect, useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { wmoWeatherIcon } from '../utils/weatherCodeIcon';

const FALLBACK = { lat: 40.7128, lng: -74.006 }; // NYC — only if geolocation unavailable

function formatHour(d, locale) {
  return d.toLocaleTimeString(locale, { hour: 'numeric', hour12: locale === 'en-US' });
}

function celsiusLabel(c, preferF) {
  if (!Number.isFinite(c)) return '—';
  if (preferF) return `${Math.round((c * 9) / 5 + 32)}°F`;
  return `${Math.round(c)}°C`;
}

export default function WeatherTemperatureBar() {
  const { t, lang } = useI18n();
  const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
  const preferF = useMemo(
    () => typeof navigator !== 'undefined' && /^en-?US/i.test(navigator.language || ''),
    [],
  );

  const [status, setStatus] = useState('loading');
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    document.body.classList.add('has-weather-bar');
    return () => document.body.classList.remove('has-weather-bar');
  }, []);

  useEffect(() => {
    let cancelled = false;

    function pickLatLng() {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(FALLBACK);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(FALLBACK),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
        );
      });
    }

    (async () => {
      setStatus('loading');
      try {
        const { lat, lng } = await pickLatLng();
        if (cancelled) return;
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', String(lat));
        url.searchParams.set('longitude', String(lng));
        url.searchParams.set('hourly', 'temperature_2m,weather_code');
        url.searchParams.set('forecast_days', '2');
        url.searchParams.set('timezone', 'auto');
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('forecast');
        const data = await res.json();
        const times = data?.hourly?.time || [];
        const temps = data?.hourly?.temperature_2m || [];
        const codes = data?.hourly?.weather_code || [];
        const nowMs = Date.now();
        const next = [];
        for (let i = 0; i < times.length && next.length < 18; i += 1) {
          const tMs = new Date(times[i]).getTime();
          if (tMs < nowMs - 45 * 60 * 1000) continue;
          next.push({
            key: times[i],
            at: new Date(times[i]),
            temp: Number(temps[i]),
            code: codes[i],
          });
        }
        if (cancelled) return;
        setSlots(next);
        setStatus(next.length ? 'ready' : 'error');
      } catch {
        if (!cancelled) {
          setSlots([]);
          setStatus('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (status === 'loading' && slots.length === 0) {
    return (
      <aside className="weather-temperature-bar" aria-busy="true" aria-label={t('common.weather_forecast')}>
        <div className="weather-temperature-bar-inner weather-temperature-bar--loading">
          <span className="weather-temp-loading-icon" aria-hidden>🌡️</span>
          <span>{t('common.weather_loading')}</span>
        </div>
      </aside>
    );
  }

  if (status === 'error' || slots.length === 0) {
    return (
      <aside className="weather-temperature-bar" aria-label={t('common.weather_forecast')}>
        <div className="weather-temperature-bar-inner weather-temperature-bar--empty">
          <span className="weather-temp-loading-icon" aria-hidden>🌡️</span>
          <span>{t('common.weather_error')}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="weather-temperature-bar" aria-label={t('common.weather_forecast')}>
      <div className="weather-temperature-bar-inner weather-temperature-bar--scroll" role="list">
        {slots.map((s) => (
          <div key={s.key} className="weather-temp-slot" role="listitem">
            <span className="weather-temp-slot-icon" aria-hidden>
              {wmoWeatherIcon(s.code)}
            </span>
            <span className="weather-temp-slot-deg">{celsiusLabel(s.temp, preferF)}</span>
            <span className="weather-temp-slot-hour">{formatHour(s.at, locale)}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
