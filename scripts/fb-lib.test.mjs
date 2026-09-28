import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notifAgeMinutes, UNKNOWN_AGE } from './fb-lib.mjs';
import { group } from './notif-scan.mjs';

test('notifAgeMinutes takes the LAST age token: a number inside the quoted comment never wins', () => {
  assert.equal(notifAgeMinutes('Anna commented on your post: "I have been vegan for a year, 5 years ago I ate meat" 2h'), 120);
  assert.equal(notifAgeMinutes('Les M replied to your comment: "3d printing is not the point" 29m·1 Reaction'), 29);
  assert.equal(notifAgeMinutes('Kirk mentioned you in a comment. 10h'), 600);
  assert.equal(notifAgeMinutes('Dori commented on a post you follow. 3d'), 4320);
});

test('notifAgeMinutes: long renders and the unknown sentinel', () => {
  assert.equal(notifAgeMinutes('Jason replied: "ok" a few seconds ago'), 0);
  assert.equal(notifAgeMinutes('Jason replied: "ok" about an hour ago'), 60);
  assert.equal(notifAgeMinutes('Jason replied: "ok" Just now'), 0);
  assert.equal(notifAgeMinutes('Now in Antinatalismo: new post 5w'), 5 * 10080);
  assert.equal(notifAgeMinutes('Jason replied with no age at all'), UNKNOWN_AGE);
});

test('notif-scan group(): freshness comes from the tail of the full text, not the 160-char display slice', () => {
  const quote = 'I have been vegan for a year and I still think '.repeat(5);
  const full = `Anna Angelika replied to your comment in Vegans V's Meat Eaters: "${quote}" 2h`;
  const item = { post_id: '1', group_id: '9', notif_t: 'group_comment', comment_id: 'c', reply_comment_id: null, openUrl: 'u', text: full.slice(0, 160), ageText: full };
  const { groups, stale } = group([item]);
  assert.equal(stale.length, 0);
  assert.equal(groups[0].freshestMin, 120);
});
