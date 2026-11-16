import React, { useState } from 'react';
import {
  Check,
  Edit3,
  HelpCircle,
  RotateCcw,
  ShieldCheck,
  SkipForward,
} from 'lucide-react';
import {
  ClarifyPrompt,
  DimensionId,
  DimensionNode,
  NodeStatus,
  UncertaintyAnalysis,
} from '../engine/mindcareEngine';

interface Phase1ClarifyViewProps {
  originalVoice: string;
  onUpdateOriginalVoice: (text: string) => void;
  analysis: UncertaintyAnalysis;
  nodes: DimensionNode[];
  onUpdateNode: (id: DimensionId, summary: string, status: NodeStatus) => void;
  mapSignedByPatient: boolean;
  mapSignedAt: string | null;
  onSignMap: () => void;
  onResetToUncertain: () => void;
  onOpenMapTab: () => void;
}

const SAMPLE_NARRATIVES = [
  "A lot of changes are happening in my mind, but I don't know what is happening or how to explain it.",
  'Since starting the new dose 3 weeks ago, evenings feel strange — my chest gets tight and finishing sentences takes effort.',
  'Everything feels slightly foggy in the mornings after poor sleep, not really sad, just disconnected.',
];

export const Phase1ClarifyView: React.FC<Phase1ClarifyViewProps> = ({
  originalVoice,
  onUpdateOriginalVoice,
  analysis,
  nodes,
  onUpdateNode,
  mapSignedByPatient,
  mapSignedAt,
  onSignMap,
  onResetToUncertain,
  onOpenMapTab,
}) => {
  const [activePromptIdx, setActivePromptIdx] = useState(0);
  const [customDraft, setCustomDraft] = useState('');
  const [editingDimension, setEditingDimension] = useState<DimensionId | null>(null);
  const [dimEditText, setDimEditText] = useState('');

  const currentPrompt: ClarifyPrompt | undefined =
    analysis.prompts[activePromptIdx] || analysis.prompts[0];

  const verifiedCount = nodes.filter((n) => n.status === 'verified' || n.status === 'partial').length;
  const uncertainCount = nodes.filter((n) => n.status === 'uncertain').length;

  const handleApplyPromptAnswer = (answerText: string, status: NodeStatus = 'verified') => {
    if (!currentPrompt) return;
    onUpdateNode(currentPrompt.dimension, answerText, status);
    setCustomDraft('');
    if (activePromptIdx < analysis.prompts.length - 1) {
      setActivePromptIdx((prev) => prev + 1);
    }
  };

  const handleLeaveUncertain = () => {
    if (!currentPrompt) return;
    const existing = nodes.find((n) => n.id === currentPrompt.dimension);
    onUpdateNode(
      currentPrompt.dimension,
      existing && existing.summary !== '—' ? existing.summary : '—',
      'uncertain'
    );
    setCustomDraft('');
    if (activePromptIdx < analysis.prompts.length - 1) {
      setActivePromptIdx((prev) => prev + 1);
    }
  };

  const handleSkipPrompt = () => {
    setCustomDraft('');
    setActivePromptIdx((prev) => (prev + 1) % analysis.prompts.length);
  };

  const startEditNode = (node: DimensionNode) => {
    setEditingDimension(node.id);
    setDimEditText(node.summary === '—' ? '' : node.summary);
  };

  const saveEditNode = (id: DimensionId, status: NodeStatus) => {
    const clean = dimEditText.trim() || '—';
    onUpdateNode(id, clean, clean === '—' && status === 'verified' ? 'uncertain' : status);
    setEditingDimension(null);
    setDimEditText('');
  };

  const workingSummaryParts = nodes
    .filter((n) => n.summary && n.summary !== '—' && n.status !== 'not_opened')
    .map((n) => `${n.label}: ${n.summary}`);

  const uncertainLabels = nodes
    .filter((n) => n.status === 'uncertain')
    .map((n) => n.label);

  return (
    <div className="space-y-8">
      {/* Phase 1 Intro Strip */}
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-teal-700">
            Phase 1 · Treatment Initiation & Clarification
          </p>
          <h1 className="font-display text-2xl font-bold tracking-[-0.015em] text-slate-900 sm:text-3xl text-balance">
            Your map. Your words. Nothing here is a diagnosis.
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Entry is an invitation to describe, not classify. Original wording is stored untouched while the 3-tiered engine helps separate cognitive fog into parts you verify—or explicitly keep uncertain.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums">
          <span className="font-medium text-teal-700">{verifiedCount} parts verified</span>
          <span aria-hidden="true">·</span>
          <span className="font-medium text-amber-700">{uncertainCount} uncertain</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={onOpenMapTab}
            className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-teal-600 whitespace-nowrap"
          >
            Open Experience State Map
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: 02 Capture + 03 Uncertainty + 04 Adaptive Questioning */}
        <div className="space-y-6 lg:col-span-7">
          {/* 02 Capture: Verbatim Original Voice */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  01. Describe in your words
                </h2>
                <p className="text-xs text-slate-500">
                  Saved as original voice · never categorized or overwritten
                </p>
              </div>
              <div className="flex items-center gap-2">
                {SAMPLE_NARRATIVES.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onUpdateOriginalVoice(sample)}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap"
                  >
                    Example {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            <label htmlFor="original-voice-input" className="sr-only">
              Describe your experience in your own words
            </label>
            <textarea
              id="original-voice-input"
              rows={3}
              value={originalVoice}
              onChange={(e) => onUpdateOriginalVoice(e.target.value)}
              placeholder="Write the way it actually feels. You can stop at any time..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/15"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Detected unclear anchors:{' '}
                <span className="font-medium text-amber-700">
                  {analysis.detectedPhrases.length > 0
                    ? analysis.detectedPhrases.map((p) => `"${p}"`).join(', ')
                    : 'None flagged — write freely'}
                </span>
              </span>
              <span className="tabular-nums">{originalVoice.length} chars · local only</span>
            </div>
          </section>

          {/* 03 Uncertainty: Gaps listed as gaps */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  02. What feels unclear
                </h2>
                <p className="text-xs text-slate-500">
                  The system marks communication gaps — it never names a condition
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {analysis.unclearGaps.map((gap) => (
                <div
                  key={gap.dimension}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">{gap.label}</span>
                    <span
                      className={`text-[11px] font-medium ${
                        gap.status === 'uncertain' ? 'text-amber-700' : 'text-slate-500'
                      }`}
                    >
                      {gap.status === 'uncertain' ? 'Uncertain' : 'Not described'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{gap.reason}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 04 Neutral Questions: 3-Tiered Adaptive Questioning Engine */}
          {currentPrompt && (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    03. Clarify — you lead
                  </h2>
                  <p className="text-xs text-teal-700 font-medium">{currentPrompt.tierLabel}</p>
                </div>

                {/* Tier / Step selector */}
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Clarifying prompt steps">
                  {analysis.prompts.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={idx === activePromptIdx}
                      onClick={() => setActivePromptIdx(idx)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                        idx === activePromptIdx
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Q{idx + 1} · T{p.tier}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200/80">
                <p className="text-sm font-medium leading-relaxed text-slate-900">
                  {currentPrompt.question}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">
                  Targets dimension: <span className="font-medium text-slate-700 capitalize">{currentPrompt.dimension}</span> · Neutral · Adaptive · Reversible
                </p>
              </div>

              {/* Quick Somatic / Contrast Anchors */}
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-slate-600">
                  Optional anchors (tap to adopt, or write your own below):
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentPrompt.quickAnchors.map((anchor) => (
                    <button
                      key={anchor}
                      type="button"
                      onClick={() => handleApplyPromptAnswer(anchor, 'verified')}
                      className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-left text-xs font-medium text-slate-800 transition-colors hover:border-teal-600 hover:bg-teal-50/60 hover:text-teal-900"
                    >
                      {anchor}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom patient response */}
              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                <label htmlFor="clarify-custom-input" className="sr-only">
                  Your clarification in your own words
                </label>
                <input
                  id="clarify-custom-input"
                  type="text"
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customDraft.trim()) {
                      handleApplyPromptAnswer(customDraft.trim(), 'verified');
                    }
                  }}
                  placeholder={`Describe ${currentPrompt.dimension} in your own words...`}
                  className="min-h-[44px] flex-1 rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                />
                <button
                  type="button"
                  disabled={!customDraft.trim()}
                  onClick={() => handleApplyPromptAnswer(customDraft.trim(), 'verified')}
                  className="min-h-[44px] rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 whitespace-nowrap shrink-0"
                >
                  Verify Part
                </button>
              </div>

              {/* Explicit Skip / Keep Uncertain controls */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">You can always pause or leave parts open</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSkipPrompt}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveUncertain}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap"
                  >
                    <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    Keep Uncertain
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Right Column: 05 Parts Board + 06 Patient Verification Gate */}
        <div className="space-y-6 lg:col-span-5">
          {/* 05 Parts Board */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  04. Split into parts
                </h2>
                <p className="text-xs text-slate-500">
                  A living checklist of meaning, not symptoms
                </p>
              </div>
              <button
                type="button"
                onClick={onResetToUncertain}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset demo
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {nodes.map((node) => {
                const isEditing = editingDimension === node.id;
                const statusLabel =
                  node.status === 'verified'
                    ? 'Verified'
                    : node.status === 'partial'
                      ? 'Partial'
                      : node.status === 'uncertain'
                        ? 'Uncertain'
                        : node.status === 'draft'
                          ? 'Draft'
                          : 'Not opened';

                const statusTextClass =
                  node.status === 'verified' || node.status === 'partial'
                    ? 'text-teal-700'
                    : node.status === 'uncertain'
                      ? 'text-amber-700'
                      : node.status === 'draft'
                        ? 'text-slate-700'
                        : 'text-slate-400';

                return (
                  <div key={node.id} className="py-3 first:pt-0 last:pb-0">
                    {isEditing ? (
                      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-900">{node.label}</span>
                          <button
                            type="button"
                            onClick={() => setEditingDimension(null)}
                            className="text-xs text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                        </div>
                        <input
                          type="text"
                          value={dimEditText}
                          onChange={(e) => setDimEditText(e.target.value)}
                          placeholder={`Describe ${node.label.toLowerCase()}...`}
                          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveEditNode(node.id, 'verified')}
                            className="rounded-md bg-teal-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-800"
                          >
                            Mark Verified
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditNode(node.id, 'uncertain')}
                            className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                          >
                            Keep Uncertain
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditNode(node.id, 'not_opened')}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            Close Part
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-slate-900">{node.label}</span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className={`font-medium ${statusTextClass}`}>{statusLabel}</span>
                          </div>
                          <p className="mt-0.5 text-sm text-slate-700 break-words">
                            {node.summary || '—'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditNode(node)}
                          aria-label={`Edit ${node.label}`}
                          className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 shrink-0"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 06 Patient Verification Gate */}
          <section className="rounded-xl border border-slate-200 bg-slate-900 p-6 text-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-teal-300">
                  Working summary · your words
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-white">
                  Does this still sound like you?
                </h2>
              </div>
              {mapSignedByPatient && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-300 whitespace-nowrap">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Signed
                </span>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-200">
              {workingSummaryParts.length > 0 ? (
                <p>{workingSummaryParts.join('. ')}.</p>
              ) : (
                <p className="text-slate-400">
                  No verified nodes yet. Everything remains in your original wording.
                </p>
              )}
              {uncertainLabels.length > 0 && (
                <p className="mt-2 text-xs text-amber-300">
                  Explicitly left uncertain: {uncertainLabels.join(', ')}.
                </p>
              )}
            </div>

            <p className="mt-3 text-xs text-slate-400">
              The Experience State Map cannot be finalized for clinical handoff until you sign off on your wording.
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onSignMap}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-teal-500 whitespace-nowrap"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {mapSignedByPatient ? 'Re-sign current summary' : 'Yes — this is what I meant'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstUnopened = nodes.find((n) => n.status === 'draft');
                  if (firstUnopened) {
                    onUpdateNode(firstUnopened.id, firstUnopened.summary, 'uncertain');
                  }
                }}
                className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 whitespace-nowrap"
              >
                Keep more uncertain
              </button>
            </div>

            {mapSignedAt && (
              <p className="mt-2.5 text-[11px] text-slate-400 tabular-nums">
                Last patient signature: {mapSignedAt}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
