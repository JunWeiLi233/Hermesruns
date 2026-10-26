import { useI18n } from '../../../contexts/I18nContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { useCommand, useResource, useWorkspace } from '../ui/workspace';
import { Button, Feedback, Panel, QueryGate, TextField } from '../ui/components';
import Access from '../screens/S22';
import Consent from '../screens/S25';
import BulkConfiguration from '../screens/S26';
import Privacy from '../screens/S28';
import './integrationTools.css';

function ModelAnchors() {
  const { t } = useI18n();
  const { api } = useWorkspace();
  const me = useResource('getMe');
  const command = useCommand();
  return <QueryGate query={me}>{profile => <Panel title={t('training_integration.modelAnchors')}>
    <p className="ds-muted">{t('training_integration.modelAnchorsCopy')}</p>
    <form className="training-integration-anchor-form" key={`${profile.id}:${profile.revision}`} onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      command.run(() => api.updateProfile({
        ftp: Number(values.get('ftp')),
        fitnessTau: Number(values.get('fitnessTau')),
        fatigueTau: Number(values.get('fatigueTau')),
        revision: profile.revision,
      }), t('training_integration.modelAnchorsSaved'));
    }}>
      <TextField label={t('training_integration.ftp')} name="ftp" type="number" min="1" max="2000" step="1" required defaultValue={profile.ftp ?? 240} />
      <TextField label={t('training_integration.fitnessTau')} name="fitnessTau" type="number" min="1" max="180" step="1" required defaultValue={profile.fitnessTau ?? 42} />
      <TextField label={t('training_integration.fatigueTau')} name="fatigueTau" type="number" min="1" max="60" step="1" required defaultValue={profile.fatigueTau ?? 7} />
      <Button type="submit" variant="primary" busy={command.busy}>{t('settings.save')}</Button>
    </form>
    <Feedback command={command} />
  </Panel>}</QueryGate>;
}

/** Account tools always run in a provider scoped to the signed-in owner. */
export default function SettingsTrainingTools({ view = 'training' }) {
  const { isDark } = useTheme();
  const { t } = useI18n();
  return <div className={`icu-design training-app hermes-training-integrated${view === 'account' ? ' coach-access-settings' : ''}`} data-theme={isDark ? 'dark' : 'light'}>
    {view === 'account' ? <>
      <header className="coach-access-heading"><h2>{t('training_integration.coachAccess.title')}</h2><p>{t('training_integration.coachAccess.intro')}</p></header>
      <Privacy hideAccountOperations />
      <Access />
      <details className="coach-access-team-settings" id="coach-access-team-settings"><summary>{t('training_integration.coachAccess.teamSettings')}</summary><Consent /></details>
    </> : <>
      <ModelAnchors />
      <details className="training-integration-bulk"><summary>{t('training_integration.bulkConfiguration')}</summary><BulkConfiguration /></details>
    </>}
  </div>;
}
