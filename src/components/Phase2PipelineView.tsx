import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  BayesianTmaxResult,
  CONFOUNDER_LABELS,
  ConfounderTag,
  DagEvaluation,
  SOMATIC_CHIPS,
  SomaticChipId,
  SomaticEvent,
} from '../engine/mindcareEngine';

interface Phase2PipelineViewProps {
  lastConfirmedTime: string;
  doseConfirmedToday: boolean;
  onConfirmDose: () => void;
  regimenPriorHours: number;
  onChangeRegimenPrior: (hours: number) => void;
  activeConfounders: ConfounderTag[];
  onToggleConfounder: (tag: ConfounderTag) => void;
  hoursPostDose: number;
  onChangeHoursPostDose: (hours: number) => void;
  bayesian: BayesianTmaxResult;
  events: SomaticEvent[];
  onLogSomaticChip: (chip: SomaticChipId, customLabel?: string) => void;
  dag: DagEvaluation;
  missedDays: number[];
  onToggleSimulateDrift: () => void;
  onResolveRetroactive: (dayIndex: number, outcome: 'yes' | 'no' | 'uncertain') => void;
}

const REGIMEN_PRIORS = [
  { label: 'Immediate-release SSRI (Prior tmax 2.0h)', hours: 2.0 },
  { label: 'Fast-absorption tablet (Prior tmax 1.5h)', hours: 1.5 },
  { label: 'Extended-release XR (Prior tmax 4.0h)', hours: 4.0 },
];

export const Phase2PipelineView: React.FC<Phase2PipelineViewProps> = ({
  lastConfirmedTime,
  doseConfirmedToday,
  onConfirmDose,
  regimenPriorHours,
  onChangeRegimenPrior,
  activeConfounders,
  onToggleConfounder,
  hoursPostDose,
  onChangeHoursPostDose,
  bayesian,
  events,
  onLogSomaticChip,
  dag,
  missedDays,
  onToggleSimulateDrift,
  onResolveRetroactive,
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(13);
  const [otherChipDraft, setOtherChipDraft] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [lastLoggedBanner, setLastLoggedBanner] = useState<string | null>(null);

  const selectedDay =
    dag.vectors.find((v) => v.dayIndex === selectedDayIndex) || dag.vectors[13];

  const pendingRetroactiveDay = dag.vectors.find(
    (v) => v.missedPrompt && !v.retroactiveClarified
  );

  // Build SVG path coordinates for Prior and Posterior density curves
  const chartW = 540;
  const chartH = 190;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maxDensity = Math.max(
    0.6,
    ...bayesian.curvePoints.map((p) => Math.max(p.priorDensity, p.posteriorDensity))
  );

  const xForHour = (h: number) => padL + (h / 8.0) * plotW;
  const yForDensity = (d: number) => padT + plotH - (d / maxDensity) * plotH;

  const priorPath = bayesian.curvePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xForHour(p.hour).toFixed(1)},${yForDensity(p.priorDensity).toFixed(1)}`)
    .join(' ');

  const posteriorPath = bayesian.curvePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xForHour(p.hour).toFixed(1)},${yForDensity(p.posteriorDensity).toFixed(1)}`)
    .join(' ');

  const windowX1 = xForHour(bayesian.windowStart);
  const windowX2 = xForHour(bayesian.windowEnd);
  const currentMarkerX = xForHour(hoursPostDose);

  const handleChipTap = (chipId: SomaticChipId) => {
    if (chipId === 'other') {
      setShowOtherInput(true);
      return;
    }
    const meta = SOMATIC_CHIPS.find((c) => c.id === chipId);
    onLogSomaticChip(chipId, meta?.label);
    setLastLoggedBanner(`Logged "${meta?.label}" at +${hoursPostDose.toFixed(1)}h post-dose (<2s capture)`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-teal-700">
            Phase 2 · Micro-Level Side-Effect Pipeline
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance">
            Ingestion Anchor, Bayesian tmax & Longitudinal DAG
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Replaces 30-day retrospective recall with zero-friction dose anchoring, self-calibrating pharmacokinetic curves, and 14-day noise filtering. Surfaces timing and patterns; clinicians retain 100% diagnostic authority.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums">
          <span>
            tmax Window:{' '}
            <strong className={bayesian.inActiveWindow ? 'text-teal-700' : 'text-slate-700'}>
              {bayesian.inActiveWindow ? 'OPEN' : 'STANDBY'} ({bayesian.windowStart}h–{bayesian.windowEnd}h)
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Confidence: <strong className="text-slate-900">{bayesian.confidencePct}%</strong>
          </span>
        </div>
      </section>

      {/* Top Row: 07 Ingestion Anchor + Bayesian Adaptive tmax Curve */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* 07 Ingestion Anchor */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  01. Ingestion Anchor (t₀)
                </h2>
                <p className="text-xs text-slate-500">
                  Confirm when you take it — this starts the pharmacokinetic clock
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {lastConfirmedTime}
              </span>
            </div>

            <div className="mt-5 flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50/70 p-5 text-center">
              <button
                type="button"
                onClick={onConfirmDose}
                className={`flex h-28 w-28 flex-col items-center justify-center rounded-full text-white transition-transform active:scale-95 ${
                  doseConfirmedToday
                    ? 'bg-teal-700 hover:bg-teal-800'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                <span className="font-display text-sm font-bold">
                  {doseConfirmedToday ? 'Logged t₀' : 'I took it'}
                </span>
                <span className="mt-0.5 text-[11px] text-teal-100">
                  {doseConfirmedToday ? 'tap to update' : 'tap to confirm'}
                </span>
              </button>

              <p className="mt-3 text-xs text-slate-600 tabular-nums">
                Last confirmed: <strong className="text-slate-900">{lastConfirmedTime}</strong>
              </p>
            </div>

            {/* Regimen Prior */}
            <div className="mt-4">
              <label
                htmlFor="regimen-prior-select"
                className="block text-xs font-medium text-slate-700"
              >
                Clinical Prior Reference (Non-Diagnostic)
              </label>
              <select
                id="regimen-prior-select"
                value={regimenPriorHours}
                onChange={(e) => onChangeRegimenPrior(Number(e.target.value))}
                className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none"
              >
                {REGIMEN_PRIORS.map((r) => (
                  <option key={r.hours} value={r.hours}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Environmental Confounder Tagging */}
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-700">
                Optional: Environmental Confounder Tags (adjusts gastric emptying & DAG filter)
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Object.keys(CONFOUNDER_LABELS) as ConfounderTag[]).map((tag) => {
                  const active = activeConfounders.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onToggleConfounder(tag)}
                      aria-pressed={active}
                      className={`min-h-[36px] rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'border-amber-500 bg-amber-50 text-amber-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {CONFOUNDER_LABELS[tag]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Bayesian Adaptive tmax Curve Mapping */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                02. Bayesian Adaptive tmax Curve
              </h2>
              <p className="text-xs text-slate-500">
                Self-calibrating personal curve updated from somatic clusters & gastric confounders
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-600 tabular-nums">
              <span>Prior: {bayesian.textbookPriorMean}h</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-teal-700">
                Posterior: {bayesian.posteriorMean}h (±{bayesian.posteriorStd}h)
              </span>
            </div>
          </div>

          {/* SVG Density Plot */}
          <div className="mt-4 overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full min-w-[440px]"
              role="img"
              aria-label="Bayesian Adaptive tmax probability curve comparing textbook prior and personal posterior"
            >
              {/* Active tmax vulnerability window shading */}
              <rect
                x={windowX1}
                y={padT}
                width={Math.max(4, windowX2 - windowX1)}
                height={plotH}
                fill="#0D9488"
                fillOpacity="0.12"
              />
              <line
                x1={windowX1}
                y1={padT}
                x2={windowX1}
                y2={padT + plotH}
                stroke="#0D9488"
                strokeOpacity="0.35"
                strokeDasharray="3 3"
              />
              <line
                x1={windowX2}
                y1={padT}
                x2={windowX2}
                y2={padT + plotH}
                stroke="#0D9488"
                strokeOpacity="0.35"
                strokeDasharray="3 3"
              />

              {/* X axis baseline */}
              <line
                x1={padL}
                y1={padT + plotH}
                x2={chartW - padR}
                y2={padT + plotH}
                stroke="#CBD5E1"
                strokeWidth="1"
              />

              {/* Textbook Prior Curve */}
              <path
                d={priorPath}
                fill="none"
                stroke="#94A3B8"
                strokeWidth="1.75"
                strokeDasharray="5 4"
              />

              {/* Posterior Curve */}
              <path
                d={posteriorPath}
                fill="none"
                stroke="#0D9488"
                strokeWidth="2.5"
              />

              {/* Current elapsed time marker */}
              <line
                x1={currentMarkerX}
                y1={padT}
                x2={currentMarkerX}
                y2={padT + plotH}
                stroke="#0F172A"
                strokeWidth="1.5"
              />
              <circle
                cx={currentMarkerX}
                cy={padT + 6}
                r="4"
                fill={bayesian.inActiveWindow ? '#0D9488' : '#0F172A'}
              />

              {/* Hour ticks */}
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((hr) => (
                <text
                  key={hr}
                  x={xForHour(hr)}
                  y={chartH - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#64748B"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {hr}h
                </text>
              ))}
            </svg>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-slate-400 border-t border-dashed border-slate-500" />
                Textbook prior
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-teal-700" />
                Calibrated posterior
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-xs bg-teal-600/20 border border-teal-600/40" />
                Active tmax window
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="hours-post-dose-slider" className="text-xs font-medium text-slate-700 whitespace-nowrap">
                Elapsed post-dose: <span className="font-mono tabular-nums text-slate-900">{hoursPostDose.toFixed(1)}h</span>
              </label>
              <input
                id="hours-post-dose-slider"
                type="range"
                min={0.2}
                max={6.0}
                step={0.1}
                value={hoursPostDose}
                onChange={(e) => onChangeHoursPostDose(Number(e.target.value))}
                className="w-32 accent-teal-700"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Middle Row: 08 Somatic Event Logging (<2s) */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              03. Somatic Event Logging (&lt;2 second capture)
            </h2>
            <p className="text-xs text-slate-500">
              Visuo-spatial macro-chips fire inside the tmax vulnerability window · Skip anytime · No forced numeric scales
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs tabular-nums">
            <Clock className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
            <span className={bayesian.inActiveWindow ? 'font-semibold text-teal-700' : 'text-slate-600'}>
              {bayesian.inActiveWindow
                ? `tmax window open · ~${hoursPostDose.toFixed(1)}h post-dose`
                : `Outside peak window (~${hoursPostDose.toFixed(1)}h post-dose · logging still optional)`}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
          {SOMATIC_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => handleChipTap(chip.id)}
              className="flex min-h-[64px] flex-col items-start justify-center rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-left transition-colors hover:border-teal-600 hover:bg-teal-50/70 focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              <span className="text-xs font-semibold text-slate-900">{chip.label}</span>
              <span className="mt-0.5 text-[11px] text-slate-500">{chip.anchorHint}</span>
            </button>
          ))}
        </div>

        {showOtherInput && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="other-somatic-input" className="sr-only">
              Describe another bodily sensation
            </label>
            <input
              id="other-somatic-input"
              type="text"
              value={otherChipDraft}
              onChange={(e) => setOtherChipDraft(e.target.value)}
              placeholder="Describe bodily sensation briefly (e.g., dry mouth, warm ears)..."
              className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
            />
            <button
              type="button"
              disabled={!otherChipDraft.trim()}
              onClick={() => {
                onLogSomaticChip('other', otherChipDraft.trim());
                setLastLoggedBanner(`Logged "${otherChipDraft.trim()}" at +${hoursPostDose.toFixed(1)}h post-dose`);
                setOtherChipDraft('');
                setShowOtherInput(false);
              }}
              className="min-h-[40px] rounded-lg bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-500"
            >
              Log Sensation
            </button>
            <button
              type="button"
              onClick={() => setShowOtherInput(false)}
              className="min-h-[40px] rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        )}

        {lastLoggedBanner && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-teal-50 px-3.5 py-2 text-xs font-medium text-teal-900 border border-teal-200">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
              {lastLoggedBanner}
            </span>
            <span className="text-[11px] text-teal-700 tabular-nums">
              Total logged events: {events.length}
            </span>
          </div>
        )}
      </section>

      {/* Bottom Row: 09 14-Day Longitudinal DAG ΔState + Telemetry & Silent Drift */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* 14-Day DAG View */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                04. 14-Day Longitudinal DAG (ΔState Noise Filter)
              </h2>
              <p className="text-xs text-slate-500">
                Isolated anomalies filtered · only coherent pharmacokinetic patterns surface
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 tabular-nums">
              <span className="font-medium text-teal-700">
                {dag.pkPeakCount} PK peaks
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-amber-700">
                {dag.confounderCount} confounders
              </span>
            </div>
          </div>

          {/* 14-bar interactive chart */}
          <div className="mt-5 grid grid-cols-14 items-end gap-1.5 rounded-lg border border-slate-100 bg-slate-50/70 p-4 h-48">
            {dag.vectors.map((vec) => {
              const isSelected = vec.dayIndex === selectedDayIndex;
              const barColor =
                vec.classification === 'pk_peak'
                  ? 'bg-teal-600 hover:bg-teal-700'
                  : vec.classification === 'confounder'
                    ? 'bg-amber-400 hover:bg-amber-500'
                    : vec.missedPrompt && !vec.retroactiveClarified
                      ? 'bg-rose-300 hover:bg-rose-400'
                      : 'bg-slate-200 hover:bg-slate-300';

              return (
                <button
                  key={vec.dayIndex}
                  type="button"
                  onClick={() => setSelectedDayIndex(vec.dayIndex)}
                  aria-label={`${vec.dateLabel}: ${vec.classification.replace('_', ' ')}`}
                  className="group flex h-full flex-col items-center justify-end gap-1.5 focus:outline-none"
                >
                  <div
                    className={`w-full rounded-t-md transition-all ${barColor} ${
                      isSelected ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                    }`}
                    style={{ height: `${vec.intensity}%` }}
                  />
                  <span
                    className={`text-[10px] font-mono tabular-nums ${
                      isSelected ? 'font-bold text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {vec.dayIndex === 13 ? 'Now' : vec.dayIndex + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-teal-600" />
                High-confidence PK peak
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-amber-400" />
                Possible confounder
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-slate-200" />
                Background / quiet
              </span>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              Inspecting: <strong className="text-slate-800">{selectedDay.dateLabel}</strong> —{' '}
              {selectedDay.chips.length > 0
                ? `${selectedDay.chips.join(', ')} at +${selectedDay.hoursPostDose}h`
                : selectedDay.missedPrompt && !selectedDay.retroactiveClarified
                  ? 'Missed check-in window'
                  : 'Quiet baseline'}
            </span>
          </div>
        </section>

        {/* Telemetry & Silent Drift Escalation */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-slate-900">
                05. Telemetry & Silent Drift
              </h2>
              <Activity className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Passive circadian/motor continuity & retroactive micro-clarification
            </p>

            <div
              className={`mt-4 rounded-lg border p-3.5 ${
                dag.silentDriftStatus === 'silent_drift_alert'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : dag.silentDriftStatus === 'retroactive_pending'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                {dag.silentDriftStatus === 'silent_drift_alert' && (
                  <AlertTriangle className="h-4 w-4 text-rose-700" aria-hidden="true" />
                )}
                <span>
                  {dag.silentDriftStatus === 'silent_drift_alert'
                    ? `Silent Drift Alert (${dag.missedStreak}d unlogged)`
                    : dag.silentDriftStatus === 'retroactive_pending'
                      ? 'Retroactive Clarification Pending'
                      : 'Continuity Nominal'}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed opacity-90">
                {dag.silentDriftStatus === 'silent_drift_alert'
                  ? 'Sustained abandonment detected. Flagged in provider SMART-on-FHIR handoff without autonomous diagnosis.'
                  : dag.silentDriftStatus === 'retroactive_pending'
                    ? 'A missed live tmax window triggered a zero-burden retroactive check-in.'
                    : 'Consistent t₀ anchoring and circadian baseline active.'}
              </p>
            </div>

            {pendingRetroactiveDay && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs font-semibold text-slate-900">
                  Retroactive Prompt ({pendingRetroactiveDay.dateLabel})
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Missed live prompt around +{bayesian.posteriorMean}h. Did you notice somatic shifts?
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onResolveRetroactive(pendingRetroactiveDay.dayIndex, 'yes')}
                    className="rounded-md bg-teal-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-800"
                  >
                    Yes, shifted
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveRetroactive(pendingRetroactiveDay.dayIndex, 'no')}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveRetroactive(pendingRetroactiveDay.dayIndex, 'uncertain')}
                    className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Uncertain
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onToggleSimulateDrift}
              className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {missedDays.length > 0
                ? 'Clear Simulated Missed Days'
                : 'Simulate Missed Windows (Test Silent Drift)'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
