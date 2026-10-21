import { useWorkspace, useResource } from '../ui/workspace.jsx';
import { useI18n } from '../../../contexts/I18nContext';
import { LineChart, Notice, Panel, QueryGate } from '../ui/components.jsx';
export default function Fitness() {
  const {t}=useI18n();
  const {
      athleteId
    } = useWorkspace(),
    query = useResource('getFitness', {
      athleteId
    });
  return <QueryGate query={query}>{data => <Panel title={t('training_integration.fitnessModel')} meta={t('training_integration.fitnessModelBasis')}><LineChart title="Fitness, fatigue and form" units="load units" series={[{
        name: 'Actual fitness',
        values: data.items.map(d => d.projected ? null : d.fitness)
      }, {
        name: 'Projected fitness',
        dashed: true,
        values: data.items.map(d => d.projected ? d.fitness : null)
      }, {
        name: 'Actual fatigue',
        values: data.items.map(d => d.projected ? null : d.fatigue)
      }, {
        name: 'Actual form',
        dashed: true,
        values: data.items.map(d => d.projected ? null : d.form)
      }]} /><Notice>{data.assumption}</Notice><details><summary>How this model works</summary><p>Daily recurrence uses exponential smoothing with separate time constants. Form is fitness minus fatigue. These are estimates from the Hermes HR/RPE model. Completed prescriptions are excluded from remaining projections.</p><ul>{data.items.filter(d => d.provisional).map(d => <li key={d.date}>{d.date}: incomplete load coverage</li>)}</ul></details></Panel>}</QueryGate>;
}
