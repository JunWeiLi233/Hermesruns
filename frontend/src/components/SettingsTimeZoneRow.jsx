import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiJson } from '../api';
import { invalidateResourceCache } from '../api/resourceCache';
import { getDeviceTimeZone, listTimeZones } from '../utils/timeZone';

/**
 * The time zone Hermes uses to put a run on a calendar day. Until the runner picks one it is taken from
 * the device, once, and the row says so.
 */
export default function SettingsTimeZoneRow({ t, timeZone, onSaved }) {
  const deviceZone = useMemo(() => getDeviceTimeZone(), []);
  const zones = useMemo(() => listTimeZones(timeZone, deviceZone), [timeZone, deviceZone]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const autoApplied = useRef(false);
  const current = timeZone || deviceZone;

  const save = useCallback(async (zone, automatic) => {
    setSaving(true);
    setMessage('');
    setFailed(false);
    try {
      const profile = await apiJson('/api/profile/me/time-zone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeZone: zone }),
      });
      invalidateResourceCache('/api/profile/me');
      onSaved?.(profile?.timeZone || zone);
      setMessage(automatic ? t('settings.time_zone_auto') : t('settings.time_zone_saved'));
    } catch (error) {
      setFailed(true);
      setMessage(error?.status === 400 ? t('settings.time_zone_unsupported') : t('settings.time_zone_error'));
    } finally {
      setSaving(false);
    }
  }, [onSaved, t]);

  useEffect(() => {
    if (timeZone || !deviceZone || autoApplied.current) return;
    autoApplied.current = true;
    save(deviceZone, true);
  }, [timeZone, deviceZone, save]);

  return (
    <div className="st-v2-row">
      <div className="st-v2-row-copy">
        <strong id="settings-time-zone-label">{t('settings.time_zone_title')}</strong>
        <span>{t('settings.time_zone_copy')}</span>
        {message ? <span role={failed ? 'alert' : 'status'}>{message}</span> : null}
      </div>
      <select
        className="st-v2-select"
        aria-labelledby="settings-time-zone-label"
        value={current}
        disabled={saving}
        onChange={(event) => save(event.target.value, false)}
      >
        {current ? null : <option value="">—</option>}
        {zones.map((zone) => (
          <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>
        ))}
      </select>
    </div>
  );
}
