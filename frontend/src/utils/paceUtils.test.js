import assert from 'node:assert';
import { calculatePace, formatPace } from './paceUtils.js';

console.log('Running paceUtils tests...');

// Test calculatePace
{
  console.log('- should calculate correct pace for 10km in 50min');
  assert.strictEqual(calculatePace(10, 50), '5:00/km');
}

{
  console.log('- should return null for zero distance');
  assert.strictEqual(calculatePace(0, 50), null);
}

{
  console.log('- should return null for zero time');
  assert.strictEqual(calculatePace(10, 0), null);
}

{
  console.log('- should handle marathon pace over 42.195km in 4 hours');
  assert.strictEqual(calculatePace(42.195, 240), '5:41/km');
}

{
  console.log('- should round pace seconds cleanly');
  assert.strictEqual(calculatePace(5, 25.5), '5:06/km');
}

// Test formatPace
{
  console.log('- should format 300s/km as 5:00/km');
  assert.strictEqual(formatPace(300), '5:00/km');
}

{
  console.log('- should format 341s/km as 5:41/km');
  assert.strictEqual(formatPace(341), '5:41/km');
}

{
  console.log('- should handle null or zero pace');
  assert.strictEqual(formatPace(0), '--:--/km');
  assert.strictEqual(formatPace(null), '--:--/km');
}

console.log('All paceUtils tests passed!');
