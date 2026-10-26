import { useWorkspace, useResource } from '../ui/workspace.jsx';
import { LineChart, Notice, Panel, QueryGate } from '../ui/components.jsx';
export default function Power() {
  const {
      athleteId
    } = useWorkspace(),
    q = useResource('getActivities', {
      athleteId
    });
  return <QueryGate query={q}>{data => {
      const eligible = data.items.filter(a => a.samples.some(s => s.power != null));
      const durations = [1, 5, 10, 20];
      const values = durations.map(min => {
        let best = null;
        eligible.forEach(a => {
          for (let i = 0; i + min < a.samples.length; i++) {
            const sample = a.samples.slice(i, i + min);
            if (sample.every(s => s.power != null)) {
              const avg = sample.reduce((n, s) => n + s.power, 0) / sample.length;
              best = best == null ? avg : Math.max(best, avg);
            }
          }
        });
        return best;
      });
      return <Panel title="Historical power envelope" meta="Original one-minute-sample approximation"><LineChart title="Best average power at 1, 5, 10 and 20 minutes" units="W" series={[{
          name: 'Observed power',
          values
        }]} /><Notice tone="warning">This bounded local illustration assumes one-minute samples. Critical-power fitting, W′ modelling and exact rolling-duration curves require validated analysis. No model output is invented for missing streams.</Notice></Panel>;
    }}</QueryGate>;
}
