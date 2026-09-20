import test from 'node:test';
import assert from 'node:assert/strict';
import { caption, normalizeText } from '../src/detection/normalize';
import { detectSponsors } from '../src/detection/detector';
import { matchCaptions } from '../src/detection/matcher';
import { scoreEvidence } from '../src/detection/scoring';
import { findStart } from '../src/detection/boundaries';
import type { CaptionSegment } from '../src/lib/types';

function sponsor(offset = 0): CaptionSegment[] {
  return [
    caption(offset + 10, 3, 'Before we continue'),
    caption(offset + 13, 5, 'this video is sponsored by NordVPN'),
    caption(offset + 18, 5, 'Go to example.com and use code JOHN for 20 percent off'),
    caption(offset + 23, 5, 'You can connect your devices at home'),
    caption(offset + 28, 5, 'Find the link in the description for your free trial'),
    caption(offset + 33, 4, 'Thanks again to our friends'),
    caption(offset + 37, 4, 'Back to the video.'),
    caption(offset + 41, 5, 'The next step is to measure the distance'),
  ];
}
test('normalizes entities, curly apostrophes, artifacts, punctuation, and whitespace', () => {
  assert.equal(normalizeText(' [Music] TODAY&rsquo;S Sponsor &amp; <b>CODE</b>  &#74;OHN! ♪'), "today's sponsor & code john".replace('& ', ''));
  assert.equal(normalizeText('go to example.com\n20% off'), 'go to example.com 20% off');
  assert.doesNotThrow(() => normalizeText('&#99999999; &#xD800;'));
});
test('strong start, conservative auto decision and exact boundaries', () => {
  const [s] = detectSponsors(sponsor());
  assert.equal(s?.start, 10); assert.equal(s?.end, 37); assert.equal(s?.decision, 'auto');
  assert.equal(s?.boundary, 'return'); assert.ok(s.score >= 19);
});
test('opening in a single caption and automatic captions split across events', () => {
  assert.equal(matchCaptions([caption(4, 5, 'Before we continue, this video is sponsored by NordVPN.')])[0]?.opening, true);
  const rows = matchCaptions([caption(10, 2, 'this video is'), caption(12, 3, 'sponsored by NordVPN')]);
  assert.equal(rows[0]?.opening, true); assert.equal(rows[1]?.opening, false);
});
test('documentary sponsorship, lone link, and content return alone are not sponsors', () => {
  for (const text of ['The football team is sponsored by Nike.', 'Advertising and brand sponsorship are common.', 'Link in the description.', 'Back to the video.', 'Sign up for our local walking group.']) {
    assert.deepEqual(detectSponsors([caption(10, 10, text)]), []);
  }
});
test('commercial cluster without explicit creator sponsorship is suggestion only', () => {
  const [s] = detectSponsors([caption(10, 8, 'Go to example.com and use code JOHN for 20 percent off.'), caption(18, 5, 'Back to the video.')]);
  assert.ok(s && s.score >= 13); assert.equal(s.decision, 'suggest');
});
test('missing end never invents a skip target, even in aggressive mode', () => {
  const [s] = detectSponsors(sponsor().slice(0, 4), 'aggressive');
  assert.equal(s?.end, null); assert.equal(s?.decision, 'suggest');
});
test('weak ending and quiet commercial tail cannot authorize auto skip', () => {
  const weak = sponsor(); weak[6] = caption(37, 4, "With that said let's move on");
  assert.equal(detectSponsors(weak, 'aggressive')[0]?.decision, 'suggest');
  const quiet = sponsor().slice(0, 5);
  for (let t = 33; t < 70; t += 5) quiet.push(caption(t, 5, 'Now measure the angle against the horizontal plane'));
  const [s] = detectSponsors(quiet);
  assert.equal(s?.boundary, 'quiet'); assert.equal(s?.decision, 'suggest'); assert.equal(s?.end, 33);
});
test('long caption gaps and sponsors under eight seconds cannot auto skip', () => {
  const gap = sponsor(); gap[6] = caption(80, 5, 'Back to the video.'); gap.splice(7);
  assert.equal(detectSponsors(gap)[0]?.decision, 'suggest');
  const short = [caption(10, 3, 'This video is sponsored by Acme. Use code X at acme.com for 20% off'), caption(13, 3, 'Back to the video.')];
  assert.notEqual(detectSponsors(short)[0]?.decision, 'auto');
});
test('multiple sponsors have separate nonoverlapping boundaries', () => {
  const results = detectSponsors([...sponsor(), ...sponsor(100)]);
  assert.deepEqual(results.map(s => [s.start, s.end]), [[10, 37], [110, 137]]);
});
test('overlapping opening patterns and repeated promo phrases score once per kind', () => {
  const rows = matchCaptions([caption(0, 5, 'Thanks to our sponsor Acme for sponsoring this video use code JOHN use code JOHN')]);
  const score = scoreEvidence(rows);
  assert.equal(score.score, 14);
  assert.equal(score.evidence.filter(e => e.rule === 'Opening phrase').length, 1);
});
test('backward transition search is bounded to twelve seconds', () => {
  const rows = matchCaptions([caption(0, 2, 'Before we begin'), caption(20, 5, 'This video is sponsored by Acme')]);
  assert.equal(findStart(rows, 1), 20);
});
test('heatmap alone and weak language plus heatmap do not create sponsors', () => {
  const heat = [{ time: 0, intensity: 0 }, { time: 20, intensity: 1 }];
  assert.deepEqual(detectSponsors([caption(10, 20, 'The history of the Roman empire')], 'aggressive', heat), []);
  assert.deepEqual(detectSponsors([caption(10, 20, 'Link below')], 'aggressive', heat), []);
});
test('optional heatmap only increases a transcript candidate score', () => {
  const baseline = detectSponsors(sponsor())[0]!;
  const supported = detectSponsors(sponsor(), 'conservative', [{ time: 30, intensity: 0.1 }, { time: 37, intensity: 0.6 }])[0]!;
  assert.equal(supported.score, baseline.score + 2); assert.equal(supported.end, baseline.end);
});
test('caption processing stays bounded for long transcripts', () => {
  const rows = Array.from({ length: 30000 }, (_, i) => caption(i * 2, 2, 'The next historical event occurred in the city'));
  const start = performance.now();
  assert.deepEqual(detectSponsors(rows), []);
  assert.ok(performance.now() - start < 3000, '30,000 captions should finish within three seconds');
});
