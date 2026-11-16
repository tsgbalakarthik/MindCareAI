import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSmartOnFhirBundle,
  computeBayesianTmax,
  createInitialSeedState,
  detectUncertainties,
  encryptEnclavePayload,
  evaluateFourteenDayDag,
} from './mindcareEngine';

test('detectUncertainties captures ambiguous phrases without assigning clinical diagnoses', () => {
  const quote =
    "A lot of changes are happening in my mind, but I don't know how to explain it.";
  const analysis = detectUncertainties(quote);

  assert.ok(analysis.detectedPhrases.length >= 1);
  assert.equal(analysis.prompts.length, 4);
  assert.ok(analysis.prompts.some((p) => p.tier === 1));
  assert.ok(analysis.prompts.some((p) => p.tier === 2));
  assert.ok(analysis.prompts.some((p) => p.tier === 3));

  const joinedQuestions = analysis.prompts.map((p) => p.question.toLowerCase()).join(' ');
  assert.ok(!joinedQuestions.includes('diagnos'));
  assert.ok(!joinedQuestions.includes('disorder'));
});

test('computeBayesianTmax shifts prior with food confounder and converges on somatic observations', () => {
  const { initialEvents } = createInitialSeedState();

  const emptyStomach = computeBayesianTmax(initialEvents, 2.0, ['empty_stomach'], 1.8);
  const withFood = computeBayesianTmax(initialEvents, 2.0, ['with_food'], 1.8);

  assert.ok(withFood.adjustedPriorMean > emptyStomach.adjustedPriorMean);
  assert.ok(withFood.posteriorMean > emptyStomach.posteriorMean);
  assert.ok(withFood.windowStart < withFood.windowEnd);
  assert.ok(withFood.curvePoints.length > 20);
});

test('evaluateFourteenDayDag separates PK peaks from environmental confounders and tracks Silent Drift', () => {
  const { initialEvents } = createInitialSeedState();
  const bayesian = computeBayesianTmax(initialEvents, 2.0, [], 2.1);

  const nominalDag = evaluateFourteenDayDag(initialEvents, bayesian, [], []);
  assert.equal(nominalDag.vectors.length, 14);
  assert.ok(nominalDag.pkPeakCount >= 3);
  assert.ok(nominalDag.confounderCount >= 1);
  assert.equal(nominalDag.silentDriftStatus, 'nominal');

  const driftDag = evaluateFourteenDayDag(initialEvents, bayesian, [10, 12, 13], []);
  // Day 11 has an event in initialEvents, so trailing streak from day 13 is 2 unless day 11 is absent;
  // check at least retroactive_pending or silent_drift_alert triggers when missed days are present
  assert.notEqual(driftDag.silentDriftStatus, 'nominal');

  const consecutiveDrift = evaluateFourteenDayDag([], bayesian, [11, 12, 13], []);
  assert.equal(consecutiveDrift.silentDriftStatus, 'silent_drift_alert');
  assert.equal(consecutiveDrift.missedStreak, 3);
});

test('buildSmartOnFhirBundle honors patient redaction toggles and preserves explicit uncertainty', () => {
  const { initialVoice, initialNodes, initialEvents, initialConsent, initialPins } =
    createInitialSeedState();
  const bayesian = computeBayesianTmax(initialEvents, 2.0, [], 1.8);
  const dag = evaluateFourteenDayDag(initialEvents, bayesian, [], []);

  const redactedConsent = {
    ...initialConsent,
    includeOriginalVoice: false,
    allowedDimensions: {
      ...initialConsent.allowedDimensions,
      context: false,
    },
  };

  const bundle = buildSmartOnFhirBundle({
    originalVoice: initialVoice,
    originalCapturedAt: '2026-08-28T09:00:00Z',
    nodes: initialNodes,
    bayesian,
    dag,
    consent: redactedConsent,
    pins: initialPins,
  });

  const entries = bundle.entry as Array<{ resource: Record<string, unknown> }>;
  const docRef = entries[0].resource;
  const content = docRef.content as Array<{ attachment: { data_preview: string } }>;
  assert.equal(content[0].attachment.data_preview, '[REDACTED BY PATIENT CONSENT CONTROL]');

  const qr = entries[1].resource;
  const items = qr.item as Array<{ linkId: string; answer: Array<{ valueString: string }> }>;
  assert.ok(!items.some((i) => i.linkId === 'context'));
  const feelingsItem = items.find((i) => i.linkId === 'feelings');
  assert.ok(feelingsItem?.answer[0].valueString.includes('Explicitly uncertain'));
});

test('encryptEnclavePayload produces real AES-GCM-256 ciphertext and IV', async () => {
  const result = await encryptEnclavePayload({ hello: 'mindcare-test' });
  assert.equal(result.algorithm, 'AES-GCM-256');
  assert.equal(result.ivHex.length, 24); // 12 bytes = 24 hex chars
  assert.ok(result.ciphertextBase64.length > 10);
  assert.ok(result.byteLength > 0);
});
