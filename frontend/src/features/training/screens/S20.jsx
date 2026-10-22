import { useI18n } from '../../../contexts/I18nContext';
import { addDays } from '../data/model.mjs';
import { currentDate } from '../data/dates.mjs';
import { useWorkspace, useResource, useCommand, useCanWrite } from '../ui/workspace.jsx';
import { Button, DataTable, Feedback, Notice, Panel, QueryGate, TextField } from '../ui/components.jsx';
import './authoring.css';
export default function Season() {
  const { t } = useI18n(), s = key => t(`training_authoring.${key}`);
  const { api, athleteId } = useWorkspace(), query = useResource('getSeasons', { athleteId }), command = useCommand(), canWrite = useCanWrite();
  return <QueryGate query={query}>{data => <Panel title={s('seasonShape')}><Notice>{t('training_integration.seasonHelp')}</Notice>
    <form onSubmit={event => {
      event.preventDefault();
      if (!canWrite || command.busy) return;
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      command.run(() => api.saveSeason({ ...fields, athleteId, weeklyMinutes: Number(fields.weeklyMinutes) }), s('seasonSaved'));
    }}><TextField label={s('seasonName')} name="name" required maxLength={160} defaultValue={s('defaultSeason')} />
      <div className="tw-grid"><TextField label={s('seasonStart')} name="start" type="date" defaultValue={currentDate()} required /><TextField label={s('seasonEnd')} name="end" type="date" defaultValue={addDays(currentDate(), 56)} required /></div>
      <TextField label={s('weeklyMinutes')} name="weeklyMinutes" type="number" min="1" max="10080" defaultValue="240" required />
      {!canWrite && <Notice>{t('training_integration.readOnly')}</Notice>}<Button type="submit" variant="primary" busy={command.busy} disabled={!canWrite}>{s('saveSeason')}</Button>
    </form><Feedback command={command} /><DataTable caption={s('savedSeasons')} rows={data.items} columns={[{ key: 'name', label: s('seasonTitle') }, { key: 'start', label: s('from') }, { key: 'end', label: s('through') }, { key: 'weeklyMinutes', label: s('weeklyMinutes') }]} />
  </Panel>}</QueryGate>;
}
