import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { WeatherGlyph } from './WeatherGlyph';

const FALLBACK = { lat: 40.7128, lng: -74.006 };

function formatHour(dateValue, locale) {
  return dateValue.toLocaleTimeString(locale, { hour: 'numeric', hour12: locale === 'en-US' });
}

function celsiusLabel(value, preferFahrenheit) {
  if (!Number.isFinite(value)) return '--';
  if (preferFahrenheit) return `${Math.round((value * 9) / 5 + 32)}°F`;
  return `${Math.round(value)}°C`;
}

export default function WeatherTemperatureBar({ variant = 'fixed', onSnapshotChange = null }) {
  const { t, lang } = useI18n();
  const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
  const preferFahrenheit = useMemo(
    () => typeof navigator !== 'undefined' && /^en-?US/i.test(navigator.language || ''),
    [],
  );

  const [status, setStatus] = useState('loading');
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    if (variant !== 'fixed') return undefined;
    document.body.classList.add('has-weather-bar');
    return () => document.body.classList.remove('has-weather-bar');
  }, [variant]);

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
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
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

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('forecast');

        const data = await response.json();
        const times = data?.hourly?.time || [];
        const temperatures = data?.hourly?.temperature_2m || [];
        const weatherCodes = data?.hourly?.weather_code || [];
        const nowMs = Date.now();
        const nextSlots = [];

        for (let index = 0; index < times.length && nextSlots.length < 18; index += 1) {
          const timestamp = new Date(times[index]).getTime();
          if (timestamp < nowMs - 45 * 60 * 1000) continue;
          nextSlots.push({
            key: times[index],
            at: new Date(times[index]),
            temp: Number(temperatures[index]),
            code: weatherCodes[index],
          });
        }

        if (cancelled) return;
        setSlots(nextSlots);
        setStatus(nextSlots.length ? 'ready' : 'error');
      } catch {
        if (!cancelled) {
          setSlots([]);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!onSnapshotChange) return;
    onSnapshotChange({
      status,
      current: slots[0] || null,
      slots,
    });
  }, [status, slots, onSnapshotChange]);

  const rootClassName = `weather-temperature-bar weather-temperature-bar--${variant}`;

  if (status === 'loading' && slots.length === 0) {
    return (
      <aside className={rootClassName} aria-busy="true" aria-label={t('common.weather_forecast')}>
        <div className="weather-temperature-bar-inner weather-temperature-bar--loading">
          <WeatherGlyph className="weather-temp-loading-icon weather-temp-glyph" />
          <span>{t('common.weather_loading')}</span>
        </div>
      </aside>
    );
  }

  if (status === 'error' || slots.length === 0) {
    return (
      <aside className={rootClassName} aria-label={t('common.weather_forecast')}>
        <div className="weather-temperature-bar-inner weather-temperature-bar--empty">
          <WeatherGlyph className="weather-temp-loading-icon weather-temp-glyph" />
          <span>{t('common.weather_error')}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className={rootClassName} aria-label={t('common.weather_forecast')}>
      <div className="weather-temperature-bar-inner weather-temperature-bar--scroll" role="list">
        {slots.map((slot) => (
          <div key={slot.key} className="weather-temp-slot" role="listitem">
            <WeatherGlyph code={slot.code} className="weather-temp-slot-icon weather-temp-glyph" />
            <span className="weather-temp-slot-deg">{celsiusLabel(slot.temp, preferFahrenheit)}</span>
            <span className="weather-temp-slot-hour">{formatHour(slot.at, locale)}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
