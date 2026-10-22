// Exact synthetic actors in the recorded disposable H2 stack only. No local runtime or database credentials.
import { cleanIsolatedActors } from './fixture-lifecycle.mjs';
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--run') {
    if (!args[++index] || args[index].startsWith('--')) throw Error('--run requires a private fixture directory.');
  } else if (!['--prepare', '--verify'].includes(args[index])) throw Error('Unknown cleanup option.');
}
if (args.includes('--prepare') && args.includes('--verify')) throw Error('Choose one cleanup phase.');
const runIndex = args.indexOf('--run');
const directory = runIndex >= 0 ? args[runIndex + 1] : process.env.HERMES_TRAINING_QA_RUN;
const phase = args.includes('--prepare') ? 'prepare' : args.includes('--verify') ? 'verify' : 'cleanup';
console.log(JSON.stringify(await cleanIsolatedActors(directory, { phase })));
