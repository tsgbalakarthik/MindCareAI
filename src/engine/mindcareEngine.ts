export type DimensionId =
  | 'thoughts'
  | 'feelings'
  | 'perceptions'
  | 'body'
  | 'timing'
  | 'change'
  | 'context'
  | 'treatment';

export type NodeStatus = 'verified' | 'partial' | 'uncertain' | 'draft' | 'not_opened';

export type ConfounderTag =
  | 'with_food'
  | 'empty_stomach'
  | 'poor_sleep'
  | 'high_caffeine'
  | 'missed_prior';

export type SomaticChipId =
  | 'heavy_limbs'
  | 'tight_chest'
  | 'restless'
  | 'foggy_head'
  | 'nausea'
  | 'jittery'
  | 'flat_energy'
  | 'other';

export interface DimensionNode {
  id: DimensionId;
  label: string;
  summary: string;
  status: NodeStatus;
  updatedAt: string;
  patientVerified: boolean;
}

export interface TimelineMilestone {
  id: string;
  label: string;
  caption: string;
  verifiedCount: number;
  uncertainCount: number;
}

export interface ClarifyPrompt {
  id: string;
  tier: 1 | 2 | 3;
  tierLabel: string;
  dimension: DimensionId;
  question: string;
  quotedFragment?: string;
  quickAnchors: string[];
  binaryOptions?: [string, string];
}

export interface UncertaintyAnalysis {
  detectedPhrases: string[];
  unclearGaps: {
    dimension: DimensionId;
    label: string;
    reason: string;
    status: 'uncertain' | 'not_described';
  }[];
  prompts: ClarifyPrompt[];
}

export interface SomaticEvent {
  id: string;
  chip: SomaticChipId;
  label: string;
  hoursPostDose: number;
  timestampIso: string;
  confounders: ConfounderTag[];
  dayIndex: number; // 0..13 (13 = today)
}

export interface BayesianTmaxResult {
  textbookPriorMean: number;
  adjustedPriorMean: number;
  posteriorMean: number;
  posteriorStd: number;
  windowStart: number;
  windowEnd: number;
  inActiveWindow: boolean;
  confidencePct: number;
  curvePoints: {
    hour: number;
    priorDensity: number;
    posteriorDensity: number;
  }[];
}

export type DagClassification = 'pk_peak' | 'confounder' | 'background';

export interface DailyVector {
  dayIndex: number;
  dateLabel: string;
  intensity: number; // 0..100
  classification: DagClassification;
  hoursPostDose: number | null;
  chips: string[];
  confounders: ConfounderTag[];
  retroactiveClarified: boolean;
  missedPrompt: boolean;
}

export interface DagEvaluation {
  vectors: DailyVector[];
  pkPeakCount: number;
  confounderCount: number;
  silentDriftStatus: 'nominal' | 'retroactive_pending' | 'silent_drift_alert';
  missedStreak: number;
}

export interface ConsentSettings {
  includeOriginalVoice: boolean;
  allowedDimensions: Record<DimensionId, boolean>;
  timeWindowDays: 7 | 14 | 30;
}

export interface DecisionPin {
  id: string;
  title: string;
  category: 'timing_adjustment' | 'formulation_review' | 'dose_pacing' | 'shared_monitoring';
  clinicianNote: string;
  confirmedByPatient: boolean;
  createdAt: string;
  tokenPreview: string;
  revoked: boolean;
}

export const DIMENSION_META: Record<DimensionId, { label: string; angleDeg: number }> = {
  feelings: { label: 'Feelings', angleDeg: -90 },
  perceptions: { label: 'Perceptions', angleDeg: -45 },
  body: { label: 'Body', angleDeg: 0 },
  treatment: { label: 'Treatment', angleDeg: 45 },
  context: { label: 'Context', angleDeg: 90 },
  change: { label: 'Change', angleDeg: 135 },
  timing: { label: 'Timing', angleDeg: 180 },
  thoughts: { label: 'Thoughts', angleDeg: -135 },
};

export const SOMATIC_CHIPS: { id: SomaticChipId; label: string; anchorHint: string }[] = [
  { id: 'heavy_limbs', label: 'Heavy limbs', anchorHint: 'weighted / sluggish' },
  { id: 'tight_chest', label: 'Tight chest', anchorHint: 'pressure / constriction' },
  { id: 'restless', label: 'Restless', anchorHint: 'unable to settle' },
  { id: 'foggy_head', label: 'Foggy head', anchorHint: 'slowed / hazy recall' },
  { id: 'nausea', label: 'Nausea', anchorHint: 'gastric discomfort' },
  { id: 'jittery', label: 'Jittery', anchorHint: 'internal tremor / wired' },
  { id: 'flat_energy', label: 'Flat energy', anchorHint: 'blunted drive' },
  { id: 'other', label: 'Other…', anchorHint: 'custom bodily cue' },
];

export const CONFOUNDER_LABELS: Record<ConfounderTag, string> = {
  with_food: 'With food',
  empty_stomach: 'Empty stomach',
  poor_sleep: 'Poor sleep',
  high_caffeine: 'High caffeine',
  missed_prior: 'Missed prior dose',
};

const AMBIGUOUS_PATTERNS: { regex: RegExp; quoteFallback: string }[] = [
  { regex: /(a lot of changes|lot of changes|everything feels different)/i, quoteFallback: 'a lot of changes' },
  { regex: /(don'?t know|not sure|hard to explain|can'?t explain)/i, quoteFallback: 'hard to explain' },
  { regex: /(less like mine|not myself|disconnected|unreal)/i, quoteFallback: 'less like mine' },
  { regex: /(foggy|hazy|cloudy|blank)/i, quoteFallback: 'foggy or hazy' },
  { regex: /(weird|strange|off somehow)/i, quoteFallback: 'feels off' },
];

/**
 * Pure non-diagnostic uncertainty detector.
 * Identifies unclear phrases and unpopulated experience dimensions without ever assigning clinical labels.
 */
export function detectUncertainties(rawText: string): UncertaintyAnalysis {
  const normalized = rawText.trim();
  const lower = normalized.toLowerCase();

  const detectedPhrases: string[] = [];
  for (const p of AMBIGUOUS_PATTERNS) {
    const match = normalized.match(p.regex);
    if (match && match[0]) {
      detectedPhrases.push(match[0]);
    }
  }
  if (detectedPhrases.length === 0 && normalized.length > 0) {
    detectedPhrases.push(normalized.slice(0, 42) + (normalized.length > 42 ? '…' : ''));
  }

  const hasThoughts = /(mind|thought|thinking|focus|sentence|racing|fast|slow)/i.test(lower);
  const hasBody = /(chest|body|heavy|tired|stomach|head|jitter|sleepy|ache|tight)/i.test(lower);
  const hasTiming = /(week|day|morning|evening|night|hour|after taking|since)/i.test(lower);
  const hasFeelings = /(sad|anxious|flat|numb|angry|afraid|scared|emotion|mood)/i.test(lower);
  const hasContext = /(sleep|work|food|meal|coffee|stress|home|morning)/i.test(lower);

  const unclearGaps: UncertaintyAnalysis['unclearGaps'] = [
    {
      dimension: 'feelings',
      label: 'Whole experience / emotional tone',
      reason: hasFeelings
        ? 'Mentioned briefly — nuance can stay open or uncertain'
        : 'Uncertain — emotional nuance not yet separated from cognitive fog',
      status: hasFeelings ? 'uncertain' : 'not_described',
    },
    {
      dimension: 'thoughts',
      label: 'Which parts changed (Thoughts vs. Perceptions)',
      reason: hasThoughts
        ? 'Cognitive shift noted — pace or ownership not yet clarified'
        : 'Not yet described',
      status: hasThoughts ? 'uncertain' : 'not_described',
    },
    {
      dimension: 'timing',
      label: 'Timing / pattern across the day',
      reason: hasTiming
        ? 'Partial timeframe mentioned — onset vs. post-dose rhythm open'
        : 'Not yet described',
      status: hasTiming ? 'uncertain' : 'not_described',
    },
    {
      dimension: 'body',
      label: 'How it feels in the body',
      reason: hasBody
        ? 'Physical cue present — somatic anchor can refine clarity'
        : 'Not yet described',
      status: hasBody ? 'uncertain' : 'not_described',
    },
  ];

  const mainQuote = detectedPhrases[0] || 'these changes';
  const prompts: ClarifyPrompt[] = [
    {
      id: 'tier1-baseline',
      tier: 1,
      tierLabel: 'Tier 1 · Baseline-Relative Contrast',
      dimension: 'thoughts',
      quotedFragment: mainQuote,
      question: `When you say "${mainQuote}", which parts feel most shifted compared with your usual baseline — thoughts, feelings, body, or timing?`,
      quickAnchors: [
        'Mostly thoughts — faster and less like mine',
        'Mostly thoughts — slower and harder to finish sentences',
        'A mix of thoughts and physical heaviness',
      ],
    },
    {
      id: 'tier2-somatic',
      tier: 2,
      tierLabel: 'Tier 2 · Tourangeau Somatic Scaffolding',
      dimension: 'body',
      question:
        'Bypassing numeric scales: does your body carry any physical anchor right now (heaviness, chest tightness, restlessness, or fog)?',
      quickAnchors: [
        'Tight chest some evenings',
        'Heavy limbs and foggy head after mornings',
        'Restless energy without clear emotional cause',
      ],
    },
    {
      id: 'tier2-timing',
      tier: 1,
      tierLabel: 'Tier 1 · Temporal Pattern',
      dimension: 'timing',
      question: 'About how long have you noticed this shift, and does it cluster at a certain part of the day?',
      quickAnchors: [
        'About 3 weeks, mostly late afternoon/evening',
        'Started within days of dose change, ~2 hours after pill',
        'Comes and goes unpredictably',
      ],
    },
    {
      id: 'tier3-context',
      tier: 3,
      tierLabel: 'Tier 3 · Zero-Burden Micro-Clarification',
      dimension: 'context',
      question: hasContext
        ? 'You noted surrounding context. Does poor sleep or meal timing noticeably amplify this experience?'
        : 'Quick binary check (optional): does this feel noticeably worse after poor sleep?',
      quickAnchors: ['Worse after poor sleep', 'No clear link to sleep'],
      binaryOptions: ['Yes, worse after poor sleep', 'Unclear / no clear link'],
    },
  ];

  return {
    detectedPhrases,
    unclearGaps,
    prompts,
  };
}

function gaussianDensity(x: number, mean: number, std: number): number {
  const safeStd = Math.max(0.25, std);
  const z = (x - mean) / safeStd;
  return Math.exp(-0.5 * z * z) / (safeStd * Math.sqrt(2 * Math.PI));
}

/**
 * Bayesian Adaptive tmax Curve Mapping.
 * Uses conjugate Normal-Normal updating over observed post-dose somatic clusters,
 * adjusted for gastric emptying environmental confounders (food vs. empty stomach).
 */
export function computeBayesianTmax(
  events: SomaticEvent[],
  textbookPriorMean = 2.0,
  activeConfounders: ConfounderTag[] = [],
  hoursElapsedSinceLastDose = 1.8
): BayesianTmaxResult {
  const hasFood = activeConfounders.includes('with_food');
  const hasEmptyStomach = activeConfounders.includes('empty_stomach');

  let adjustedPriorMean = textbookPriorMean;
  let priorStd = 0.75;

  if (hasFood) {
    adjustedPriorMean += 0.85; // delayed gastric emptying
    priorStd = 0.85;
  } else if (hasEmptyStomach) {
    adjustedPriorMean -= 0.25;
  }

  // Filter out events tagged with strong external confounders (e.g., high_caffeine) or give them lower weight
  const weightedObservations = events
    .filter((e) => e.hoursPostDose >= 0.2 && e.hoursPostDose <= 8.0)
    .map((e) => {
      const hasExternalConfounder =
        e.confounders.includes('poor_sleep') || e.confounders.includes('high_caffeine');
      return {
        x: e.hoursPostDose,
        weight: hasExternalConfounder ? 0.35 : 1.0,
      };
    });

  const obsNoiseVariance = 0.45 * 0.45;
  const priorPrecision = 1 / (priorStd * priorStd);

  let weightedPrecisionSum = 0;
  let weightedMeanSum = 0;
  for (const obs of weightedObservations) {
    const p = obs.weight / obsNoiseVariance;
    weightedPrecisionSum += p;
    weightedMeanSum += p * obs.x;
  }

  const posteriorPrecision = priorPrecision + weightedPrecisionSum;
  const posteriorMean =
    (priorPrecision * adjustedPriorMean + weightedMeanSum) / posteriorPrecision;
  const posteriorStd = Math.max(0.32, Math.sqrt(1 / posteriorPrecision));

  const windowStart = Math.max(0.25, Number((posteriorMean - 0.85 * posteriorStd).toFixed(2)));
  const windowEnd = Math.min(8.0, Number((posteriorMean + 0.85 * posteriorStd).toFixed(2)));

  const inActiveWindow =
    hoursElapsedSinceLastDose >= windowStart && hoursElapsedSinceLastDose <= windowEnd;

  // Convergence confidence grows as coherent somatic observations tighten posteriorStd
  const varianceReduction = Math.max(0, 1 - (posteriorStd * posteriorStd) / (priorStd * priorStd));
  const confidencePct = Math.min(96, Math.round(52 + varianceReduction * 44));

  const curvePoints: BayesianTmaxResult['curvePoints'] = [];
  for (let h = 0; h <= 8.001; h += 0.1) {
    const roundedH = Number(h.toFixed(1));
    curvePoints.push({
      hour: roundedH,
      priorDensity: Number(gaussianDensity(roundedH, textbookPriorMean, 0.75).toFixed(4)),
      posteriorDensity: Number(gaussianDensity(roundedH, posteriorMean, posteriorStd).toFixed(4)),
    });
  }

  return {
    textbookPriorMean: Number(textbookPriorMean.toFixed(2)),
    adjustedPriorMean: Number(adjustedPriorMean.toFixed(2)),
    posteriorMean: Number(posteriorMean.toFixed(2)),
    posteriorStd: Number(posteriorStd.toFixed(2)),
    windowStart,
    windowEnd,
    inActiveWindow,
    confidencePct,
    curvePoints,
  };
}

/**
 * 14-Day Longitudinal DAG State Delta (ΔState) Noise Filter.
 * Separates coherent tmax-locked pharmacokinetic peaks from isolated environmental confounders.
 */
export function evaluateFourteenDayDag(
  events: SomaticEvent[],
  bayesian: BayesianTmaxResult,
  missedDaysIndices: number[] = [],
  retroactiveClarifiedDays: number[] = []
): DagEvaluation {
  const vectors: DailyVector[] = [];
  let pkPeakCount = 0;
  let confounderCount = 0;

  for (let d = 0; d < 14; d++) {
    const dayEvents = events.filter((e) => e.dayIndex === d);
    const missedPrompt = missedDaysIndices.includes(d) && dayEvents.length === 0;
    const retroactiveClarified = retroactiveClarifiedDays.includes(d);

    const dateLabel = d === 13 ? 'Today' : `D-${13 - d}`;

    if (dayEvents.length === 0) {
      vectors.push({
        dayIndex: d,
        dateLabel,
        intensity: missedPrompt ? 14 : 18,
        classification: 'background',
        hoursPostDose: null,
        chips: [],
        confounders: [],
        retroactiveClarified,
        missedPrompt,
      });
      continue;
    }

    const avgHour =
      dayEvents.reduce((acc, cur) => acc + cur.hoursPostDose, 0) / dayEvents.length;
    const allConfounders = Array.from(
      new Set(dayEvents.flatMap((e) => e.confounders))
    );
    const inTmaxWindow =
      avgHour >= bayesian.windowStart - 0.25 && avgHour <= bayesian.windowEnd + 0.25;
    const hasNoiseConfounder =
      allConfounders.includes('high_caffeine') ||
      allConfounders.includes('poor_sleep') ||
      allConfounders.includes('missed_prior');

    let classification: DagClassification = 'background';
    let intensity = 32;

    if (inTmaxWindow && !hasNoiseConfounder) {
      classification = 'pk_peak';
      intensity = Math.min(95, 64 + dayEvents.length * 14);
      pkPeakCount += 1;
    } else if (hasNoiseConfounder || !inTmaxWindow) {
      classification = 'confounder';
      intensity = Math.min(82, 48 + dayEvents.length * 12);
      confounderCount += 1;
    }

    vectors.push({
      dayIndex: d,
      dateLabel,
      intensity,
      classification,
      hoursPostDose: Number(avgHour.toFixed(2)),
      chips: dayEvents.map((e) => e.label),
      confounders: allConfounders,
      retroactiveClarified,
      missedPrompt,
    });
  }

  // Compute trailing missed streak for Silent Drift Escalation
  let missedStreak = 0;
  for (let d = 13; d >= 0; d--) {
    if (vectors[d].missedPrompt && !vectors[d].retroactiveClarified) {
      missedStreak += 1;
    } else if (vectors[d].chips.length > 0 || vectors[d].retroactiveClarified) {
      break;
    }
  }

  const hasUnresolvedMissed = vectors.some((v) => v.missedPrompt && !v.retroactiveClarified);
  let silentDriftStatus: DagEvaluation['silentDriftStatus'] = 'nominal';
  if (missedStreak >= 3) {
    silentDriftStatus = 'silent_drift_alert';
  } else if (hasUnresolvedMissed) {
    silentDriftStatus = 'retroactive_pending';
  }

  return {
    vectors,
    pkPeakCount,
    confounderCount,
    silentDriftStatus,
    missedStreak,
  };
}

/**
 * Generates a Patient-Authorized, Non-SaMD SMART-on-FHIR R4 Bundle.
 * Respects granular redaction toggles and preserves explicit uncertainty flags.
 */
export function buildSmartOnFhirBundle(params: {
  originalVoice: string;
  originalCapturedAt: string;
  nodes: DimensionNode[];
  bayesian: BayesianTmaxResult;
  dag: DagEvaluation;
  consent: ConsentSettings;
  pins: DecisionPin[];
}): Record<string, unknown> {
  const {
    originalVoice,
    originalCapturedAt,
    nodes,
    bayesian,
    dag,
    consent,
    pins,
  } = params;

  const visibleNodes = nodes.filter((n) => consent.allowedDimensions[n.id]);
  const windowCutoffIndex = Math.max(0, 14 - consent.timeWindowDays);
  const filteredVectors = dag.vectors.filter((v) => v.dayIndex >= windowCutoffIndex);
  const pkPeaksInWindow = filteredVectors.filter((v) => v.classification === 'pk_peak');

  const entries: Record<string, unknown>[] = [
    {
      resource: {
        resourceType: 'DocumentReference',
        id: 'mindcare-original-voice-seed',
        status: 'current',
        date: originalCapturedAt,
        description: 'Verbatim patient initiation voice (never overwritten by model)',
        securityLabel: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
                code: consent.includeOriginalVoice ? 'R' : 'V',
                display: consent.includeOriginalVoice
                  ? 'Patient-authorized share'
                  : 'Redacted by patient',
              },
            ],
          },
        ],
        content: [
          {
            attachment: {
              contentType: 'text/plain',
              title: 'Original Voice Seed',
              data_preview: consent.includeOriginalVoice
                ? originalVoice
                : '[REDACTED BY PATIENT CONSENT CONTROL]',
            },
          },
        ],
      },
    },
    {
      resource: {
        resourceType: 'QuestionnaireResponse',
        id: 'mindcare-experience-state-map',
        status: visibleNodes.some((n) => n.patientVerified) ? 'completed' : 'in-progress',
        authored: new Date().toISOString(),
        extension: [
          {
            url: 'https://mindcare.clinical/fhir/StructureDefinition/non-samd-guardrail',
            valueString: 'Non-diagnostic patient clarification map; uncertainty explicitly preserved.',
          },
        ],
        item: visibleNodes.map((n) => ({
          linkId: n.id,
          text: n.label,
          answer: [
            {
              valueString:
                n.status === 'uncertain'
                  ? `Explicitly uncertain${n.summary && n.summary !== '—' ? ` (${n.summary})` : ''}`
                  : n.summary || 'Not opened',
            },
          ],
          extension: [
            {
              url: 'https://mindcare.clinical/fhir/StructureDefinition/verification-status',
              valueCode: n.status,
            },
          ],
        })),
      },
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'mindcare-bayesian-tmax-trajectory',
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'therapy',
                display: 'Pharmacokinetic Side-Effect Timing Correlation',
              },
            ],
          },
        ],
        code: {
          text: `Bayesian Adaptive tmax Window (${consent.timeWindowDays}-day scope)`,
        },
        valueString: `Posterior tmax ${bayesian.posteriorMean}h (window ${bayesian.windowStart}h–${bayesian.windowEnd}h); ${pkPeaksInWindow.length} coherent PK peaks surfaced, ${dag.confounderCount} environmental confounders filtered`,
        note: [
          {
            text: `Silent Drift status: ${dag.silentDriftStatus}. Shared Decision Pins: ${pins.filter((p) => !p.revoked).length} active.`,
          },
        ],
      },
    },
  ];

  return {
    resourceType: 'Bundle',
    id: 'mindcare-smart-on-fhir-handoff',
    type: 'collection',
    timestamp: new Date().toISOString(),
    meta: {
      profile: ['http://hl7.org/fhir/R4/Bundle'],
      tag: [
        { code: 'NON_DIAGNOSTIC', display: "Don't Interpret, Clarify" },
        { code: 'AES_GCM_256_LOCAL_ENCLAVE', display: 'Patient-Controlled Export' },
      ],
    },
    entry: entries,
  };
}

/**
 * Real Web Crypto API AES-GCM-256 on-device encryption for the Air-Gapped Enclave.
 */
export async function encryptEnclavePayload(plainObject: unknown): Promise<{
  algorithm: 'AES-GCM-256';
  ivHex: string;
  ciphertextBase64: string;
  byteLength: number;
  keyFingerprint: string;
}> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto SubtleCrypto unavailable in this environment.');
  }

  const key = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const rawKey = new Uint8Array(await subtle.exportKey('raw', key));
  const keyFingerprint = Array.from(rawKey.slice(0, 6))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(plainObject));
  const encryptedBuffer = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const cipherBytes = new Uint8Array(encryptedBuffer);

  let binary = '';
  for (let i = 0; i < cipherBytes.length; i++) {
    binary += String.fromCharCode(cipherBytes[i]);
  }
  const ciphertextBase64 = btoa(binary);
  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    algorithm: 'AES-GCM-256',
    ivHex,
    ciphertextBase64,
    byteLength: cipherBytes.byteLength,
    keyFingerprint,
  };
}

/**
 * Deterministic initial seed state matching the MindCare AI Concept Brief.
 */
export function createInitialSeedState() {
  const initialVoice =
    "A lot of changes are happening in my mind, but I don't know what is happening or how to explain it.";

  const initialNodes: DimensionNode[] = [
    {
      id: 'thoughts',
      label: 'Thoughts',
      summary: 'Faster, "less like mine"',
      status: 'partial',
      updatedAt: 'Now',
      patientVerified: true,
    },
    {
      id: 'feelings',
      label: 'Feelings',
      summary: '—',
      status: 'uncertain',
      updatedAt: 'Wk 0',
      patientVerified: false,
    },
    {
      id: 'perceptions',
      label: 'Perceptions',
      summary: '—',
      status: 'not_opened',
      updatedAt: '—',
      patientVerified: false,
    },
    {
      id: 'body',
      label: 'Body',
      summary: 'Tight chest some evenings',
      status: 'verified',
      updatedAt: 'Wk 2',
      patientVerified: true,
    },
    {
      id: 'timing',
      label: 'Timing',
      summary: 'About 3 weeks',
      status: 'verified',
      updatedAt: 'Wk 1',
      patientVerified: true,
    },
    {
      id: 'change',
      label: 'Change',
      summary: 'Harder to finish sentences',
      status: 'draft',
      updatedAt: 'Wk 3',
      patientVerified: false,
    },
    {
      id: 'context',
      label: 'Context',
      summary: 'Worse after poor sleep',
      status: 'verified',
      updatedAt: 'Wk 2',
      patientVerified: true,
    },
    {
      id: 'treatment',
      label: 'Treatment',
      summary: '—',
      status: 'not_opened',
      updatedAt: '—',
      patientVerified: false,
    },
  ];

  const initialTimeline: TimelineMilestone[] = [
    {
      id: 'wk0',
      label: 'Wk 0',
      caption: 'Seed only. Almost all uncertain.',
      verifiedCount: 0,
      uncertainCount: 8,
    },
    {
      id: 'wk1',
      label: 'Wk 1',
      caption: 'Thoughts + timing verified.',
      verifiedCount: 2,
      uncertainCount: 4,
    },
    {
      id: 'wk2',
      label: 'Wk 2',
      caption: 'Body + context added.',
      verifiedCount: 4,
      uncertainCount: 2,
    },
    {
      id: 'wk3',
      label: 'Wk 3',
      caption: '"Not-mine" still uncertain — kept.',
      verifiedCount: 4,
      uncertainCount: 2,
    },
    {
      id: 'now',
      label: 'Now',
      caption: 'Clinician pack ready if shared.',
      verifiedCount: 4,
      uncertainCount: 2,
    },
  ];

  const initialEvents: SomaticEvent[] = [
    {
      id: 'ev-1',
      chip: 'foggy_head',
      label: 'Foggy head',
      hoursPostDose: 2.1,
      timestampIso: '2026-11-04T10:20:00Z',
      confounders: [],
      dayIndex: 1,
    },
    {
      id: 'ev-2',
      chip: 'tight_chest',
      label: 'Tight chest',
      hoursPostDose: 2.3,
      timestampIso: '2026-11-06T10:32:00Z',
      confounders: ['with_food'],
      dayIndex: 3,
    },
    {
      id: 'ev-3',
      chip: 'jittery',
      label: 'Jittery',
      hoursPostDose: 4.8,
      timestampIso: '2026-11-08T13:00:00Z',
      confounders: ['high_caffeine', 'poor_sleep'],
      dayIndex: 5,
    },
    {
      id: 'ev-4',
      chip: 'foggy_head',
      label: 'Foggy head',
      hoursPostDose: 2.25,
      timestampIso: '2026-11-10T10:28:00Z',
      confounders: [],
      dayIndex: 7,
    },
    {
      id: 'ev-5',
      chip: 'heavy_limbs',
      label: 'Heavy limbs',
      hoursPostDose: 2.4,
      timestampIso: '2026-11-12T10:38:00Z',
      confounders: ['with_food'],
      dayIndex: 9,
    },
    {
      id: 'ev-6',
      chip: 'tight_chest',
      label: 'Tight chest',
      hoursPostDose: 2.15,
      timestampIso: '2026-11-14T10:22:00Z',
      confounders: [],
      dayIndex: 11,
    },
    {
      id: 'ev-7',
      chip: 'restless',
      label: 'Restless',
      hoursPostDose: 5.5,
      timestampIso: '2026-11-15T13:45:00Z',
      confounders: ['poor_sleep'],
      dayIndex: 12,
    },
  ];

  const initialConsent: ConsentSettings = {
    includeOriginalVoice: true,
    allowedDimensions: {
      thoughts: true,
      feelings: true,
      perceptions: false,
      body: true,
      timing: true,
      change: true,
      context: true,
      treatment: false,
    },
    timeWindowDays: 14,
  };

  const initialPins: DecisionPin[] = [
    {
      id: 'pin-1',
      title: 'Evaluate morning vs. evening dose timing',
      category: 'timing_adjustment',
      clinicianNote: 'Review 2.2h post-dose tight chest & cognitive fog cluster with prescribing psychiatrist.',
      confirmedByPatient: true,
      createdAt: '2026-11-15',
      tokenPreview: 'mc_ro_8a4f91e2',
      revoked: false,
    },
  ];

  return {
    initialVoice,
    initialNodes,
    initialTimeline,
    initialEvents,
    initialConsent,
    initialPins,
  };
}
