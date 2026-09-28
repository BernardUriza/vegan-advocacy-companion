import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dossierFilenames } from './gen-dossiers.mjs';

test('colliding slugs get -<user_id> for every colliding actor', () => {
  const { files, collided } = dossierFilenames([
    { name: 'Indecent Bystander', user_id: '965593289816591' },
    { name: 'Indecent Bystander', user_id: '1640580380575005' },
    { name: 'Indecent Bystander', user_id: '1679128970037236' },
    { name: 'Les M', user_id: '61581270521234' },
  ]);
  assert.deepEqual(files, [
    'indecent-bystander-965593289816591.md',
    'indecent-bystander-1640580380575005.md',
    'indecent-bystander-1679128970037236.md',
    'les-m.md',
  ]);
  assert.deepEqual(collided, ['indecent-bystander']);
  assert.equal(new Set(files).size, files.length);
});

test('an empty slug falls back to the user_id', () => {
  assert.deepEqual(dossierFilenames([{ name: '???', user_id: '42' }]).files, ['42.md']);
});
