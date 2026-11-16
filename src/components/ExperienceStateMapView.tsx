import React, { useState } from 'react';
import { Lock, CheckCircle2, HelpCircle, CircleDot } from 'lucide-react';
import {
  DIMENSION_META,
  DimensionId,
  DimensionNode,
  NodeStatus,
  TimelineMilestone,
} from '../engine/mindcareEngine';

interface ExperienceStateMapViewProps {
  originalVoice: string;
  originalCapturedAt: string;
  nodes: DimensionNode[];
  timeline: TimelineMilestone[];
  mapSignedByPatient: boolean;
  onUpdateNode: (id: DimensionId, summary: string, status: NodeStatus) => void;
}

export const ExperienceStateMapView: React.FC<ExperienceStateMapViewProps> = ({
  originalVoice,
  originalCapturedAt,
  nodes,
  timeline,
  mapSignedByPatient,
  onUpdateNode,
}) => {
  const [selectedId, setSelectedId] = useState<DimensionId>('thoughts');
  const [activeMilestoneId, setActiveMilestoneId] = useState<string>('now');
  const [editValue, setEditValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  const verifiedCount = nodes.filter((n) => n.status === 'verified' || n.status === 'partial').length;
  const uncertainCount = nodes.filter((n) => n.status === 'uncertain').length;

  const syncedTimeline = timeline.map((step) =>
    step.id === 'now'
      ? { ...step, verifiedCount, uncertainCount }
      : step
  );

  const selectedNode = nodes.find((n) => n.id === selectedId) || nodes[0];
  const activeMilestone =
    syncedTimeline.find((m) => m.id === activeMilestoneId) ||
    syncedTimeline[syncedTimeline.length - 1];

  const getStatusStyle = (status: NodeStatus) => {
    switch (status) {
      case 'verified':
      case 'partial':
        return {
          fill: '#CCFBF1',
          stroke: '#0D9488',
          titleColor: '#0F172A',
          subColor: '#0F766E',
          badge: status === 'partial' ? 'Partial' : 'Verified',
        };
      case 'uncertain':
        return {
          fill: '#FEF3C7',
          stroke: '#D97706',
          titleColor: '#78350F',
          subColor: '#B45309',
          badge: 'Uncertain',
        };
      case 'draft':
        return {
          fill: '#E0F2FE',
          stroke: '#0284C7',
          titleColor: '#0C4A6E',
          subColor: '#0369A1',
          badge: 'Draft',
        };
      default:
        return {
          fill: '#F1F5F9',
          stroke: '#CBD5E1',
          titleColor: '#475569',
          subColor: '#64748B',
          badge: 'Not opened',
        };
    }
  };

  const centerX = 360;
  const centerY = 220;
  const radiusX = 225;
  const radiusY = 148;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-teal-700">
            Patient-Facing Product · Structured, Dated & Uncertainty-Preserving
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance">
            Experience State Map
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Not a chatbot transcript. A living clinical communication object that keeps original wording separate, records change over time, and treats unresolved uncertainty as honest clinical signal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums">
          <span>
            Status:{' '}
            <strong className={mapSignedByPatient ? 'text-teal-700' : 'text-amber-700'}>
              {mapSignedByPatient ? 'Patient Verified' : 'Draft (Awaiting Signature)'}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>{verifiedCount} verified</span>
          <span aria-hidden="true">·</span>
          <span>{uncertainCount} uncertain</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Radial SVG Map */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Current snapshot · {activeMilestone.label}
              </h2>
              <p className="text-xs text-slate-500">
                Click any node to inspect, refine wording, or explicitly mark uncertain
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                Verified
              </span>
              <span className="inline-flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                Uncertain
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CircleDot className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                Not opened
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <svg
              viewBox="0 0 720 440"
              className="mx-auto w-full max-w-[720px] select-none"
              role="img"
              aria-label="Interactive Experience State Map radial node graph"
            >
              {/* Connection lines */}
              {nodes.map((node) => {
                const meta = DIMENSION_META[node.id];
                const rad = (meta.angleDeg * Math.PI) / 180;
                const nx = centerX + Math.cos(rad) * radiusX;
                const ny = centerY + Math.sin(rad) * radiusY;
                const isSelected = node.id === selectedId;
                return (
                  <line
                    key={`line-${node.id}`}
                    x1={centerX}
                    y1={centerY}
                    x2={nx}
                    y2={ny}
                    stroke={isSelected ? '#0D9488' : '#CBD5E1'}
                    strokeWidth={isSelected ? 2 : 1.25}
                    strokeDasharray={node.status === 'not_opened' ? '4 4' : undefined}
                  />
                );
              })}

              {/* Center YOU node */}
              <g transform={`translate(${centerX}, ${centerY})`}>
                <circle r="44" fill="#0F172A" />
                <text
                  textAnchor="middle"
                  y="-4"
                  fill="#FFFFFF"
                  fontSize="14"
                  fontWeight="700"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  YOU
                </text>
                <text
                  textAnchor="middle"
                  y="14"
                  fill={mapSignedByPatient ? '#5EEAD4' : '#FCD34D'}
                  fontSize="10"
                  fontWeight="500"
                >
                  {mapSignedByPatient ? 'verified' : 'draft'}
                </text>
              </g>

              {/* 8 Radial Dimension Nodes */}
              {nodes.map((node) => {
                const meta = DIMENSION_META[node.id];
                const rad = (meta.angleDeg * Math.PI) / 180;
                const nx = centerX + Math.cos(rad) * radiusX;
                const ny = centerY + Math.sin(rad) * radiusY;
                const style = getStatusStyle(node.status);
                const isSelected = node.id === selectedId;
                const truncated =
                  node.summary && node.summary !== '—'
                    ? node.summary.length > 22
                      ? node.summary.slice(0, 21) + '…'
                      : node.summary
                    : style.badge;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${nx - 72}, ${ny - 28})`}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.label}: ${style.badge}, ${node.summary}`}
                    onClick={() => {
                      setSelectedId(node.id);
                      setIsEditing(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(node.id);
                        setIsEditing(false);
                      }
                    }}
                  >
                    <rect
                      width="144"
                      height="56"
                      rx="10"
                      fill={style.fill}
                      stroke={isSelected ? '#0F172A' : style.stroke}
                      strokeWidth={isSelected ? 2.25 : 1.25}
                    />
                    <text
                      x="72"
                      y="23"
                      textAnchor="middle"
                      fill={style.titleColor}
                      fontSize="12.5"
                      fontWeight="700"
                      fontFamily="Plus Jakarta Sans, sans-serif"
                    >
                      {node.label}
                    </text>
                    <text
                      x="72"
                      y="41"
                      textAnchor="middle"
                      fill={style.subColor}
                      fontSize="10.5"
                      fontWeight="500"
                    >
                      {truncated}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        {/* Right Side Inspector & Original Seed Anchor */}
        <div className="space-y-6 lg:col-span-4">
          {/* Selected Node Inspector */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">Selected Dimension</span>
              <span className="text-xs font-medium text-teal-700 capitalize">
                {selectedNode.status.replace('_', ' ')}
              </span>
            </div>
            <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
              {selectedNode.label}
            </h3>

            {isEditing ? (
              <div className="mt-3 space-y-3">
                <label htmlFor="map-node-edit" className="sr-only">
                  Edit wording for {selectedNode.label}
                </label>
                <textarea
                  id="map-node-edit"
                  rows={3}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateNode(selectedNode.id, editValue.trim() || '—', 'verified');
                      setIsEditing(false);
                    }}
                    className="min-h-[38px] rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    Save & Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateNode(selectedNode.id, editValue.trim() || '—', 'uncertain');
                      setIsEditing(false);
                    }}
                    className="min-h-[38px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Save as Uncertain
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="min-h-[38px] rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                  <p className="text-sm text-slate-800">
                    {selectedNode.summary && selectedNode.summary !== '—'
                      ? selectedNode.summary
                      : 'Left open / not yet described in detail.'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 tabular-nums">
                    Updated: {selectedNode.updatedAt}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditValue(selectedNode.summary === '—' ? '' : selectedNode.summary);
                      setIsEditing(true);
                    }}
                    className="min-h-[40px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Edit Wording
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateNode(
                        selectedNode.id,
                        selectedNode.summary,
                        selectedNode.status === 'uncertain' ? 'verified' : 'uncertain'
                      )
                    }
                    className="min-h-[40px] flex-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap"
                  >
                    {selectedNode.status === 'uncertain' ? 'Mark Verified' : 'Mark Uncertain'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Original Seed Stored Separately */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Original Voice Seed
              </h3>
              <Lock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Stored separately from derived nodes · never overwritten
            </p>
            <blockquote className="mt-3 rounded-lg bg-slate-50 p-3.5 text-sm italic leading-relaxed text-slate-800 border border-slate-200/80">
              “{originalVoice}”
            </blockquote>
            <p className="mt-2 text-xs text-slate-500 tabular-nums">
              Captured {originalCapturedAt}
            </p>
          </section>
        </div>
      </div>

      {/* Change Over Time is First-Class */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Change over time is first-class
            </h2>
            <p className="text-xs text-slate-500">
              Select a milestone to review how clarity evolved without erasing uncertainty
            </p>
          </div>
          <span className="text-xs text-slate-600 tabular-nums">
            {activeMilestone.label}: {activeMilestone.verifiedCount} verified ·{' '}
            {activeMilestone.uncertainCount} uncertain
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          {syncedTimeline.map((step) => {
            const isActive = step.id === activeMilestoneId;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveMilestoneId(step.id)}
                className={`rounded-lg border p-3.5 text-left transition-colors ${
                  isActive
                    ? 'border-teal-600 bg-teal-50/70'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-slate-900">
                    {step.label}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-teal-700">
                    {step.verifiedCount}v / {step.uncertainCount}u
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{step.caption}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-lg bg-teal-50/80 px-4 py-3 text-center text-xs font-medium text-teal-900 border border-teal-200/70">
          Uncertainty is never overwritten. The map grows only when the patient verifies. What remains foggy stays marked as fog — that honesty is the clinical signal.
        </div>
      </section>
    </div>
  );
};
