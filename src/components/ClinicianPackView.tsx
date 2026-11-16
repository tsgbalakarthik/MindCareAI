import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Lock,
  Plus,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import {
  BayesianTmaxResult,
  ConsentSettings,
  DagEvaluation,
  DecisionPin,
  DimensionId,
  DimensionNode,
  buildSmartOnFhirBundle,
  encryptEnclavePayload,
} from '../engine/mindcareEngine';

interface ClinicianPackViewProps {
  originalVoice: string;
  originalCapturedAt: string;
  nodes: DimensionNode[];
  bayesian: BayesianTmaxResult;
  dag: DagEvaluation;
  consent: ConsentSettings;
  onUpdateConsent: (next: ConsentSettings) => void;
  pins: DecisionPin[];
  onAddPin: (title: string, category: DecisionPin['category'], note: string) => void;
  onToggleRevokePin: (id: string) => void;
  mapSignedByPatient: boolean;
}

export const ClinicianPackView: React.FC<ClinicianPackViewProps> = ({
  originalVoice,
  originalCapturedAt,
  nodes,
  bayesian,
  dag,
  consent,
  onUpdateConsent,
  pins,
  onAddPin,
  onToggleRevokePin,
  mapSignedByPatient,
}) => {
  const [copiedFhir, setCopiedFhir] = useState(false);
  const [enclaveCipher, setEnclaveCipher] = useState<{
    algorithm: string;
    ivHex: string;
    ciphertextBase64: string;
    byteLength: number;
    keyFingerprint: string;
  } | null>(null);
  const [encrypting, setEncrypting] = useState(false);

  const [pinTitle, setPinTitle] = useState('');
  const [pinCategory, setPinCategory] = useState<DecisionPin['category']>('timing_adjustment');
  const [pinNote, setPinNote] = useState('');

  const fhirBundle = useMemo(
    () =>
      buildSmartOnFhirBundle({
        originalVoice,
        originalCapturedAt,
        nodes,
        bayesian,
        dag,
        consent,
        pins,
      }),
    [originalVoice, originalCapturedAt, nodes, bayesian, dag, consent, pins]
  );

  const fhirJsonString = useMemo(() => JSON.stringify(fhirBundle, null, 2), [fhirBundle]);

  const visibleNodes = nodes.filter((n) => consent.allowedDimensions[n.id]);

  const handleEncrypt = async () => {
    setEncrypting(true);
    try {
      const res = await encryptEnclavePayload(fhirBundle);
      setEnclaveCipher(res);
    } finally {
      setEncrypting(false);
    }
  };

  const handleCopyFhir = async () => {
    try {
      await navigator.clipboard.writeText(fhirJsonString);
      setCopiedFhir(true);
      setTimeout(() => setCopiedFhir(false), 2000);
    } catch {
      setCopiedFhir(false);
    }
  };

  const handleDownloadFhir = () => {
    const blob = new Blob([fhirJsonString], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindcare-smart-on-fhir-bundle.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreatePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinTitle.trim()) return;
    onAddPin(
      pinTitle.trim(),
      pinCategory,
      pinNote.trim() || 'Shared during 15-minute outpatient consultation.'
    );
    setPinTitle('');
    setPinNote('');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-teal-700">
            Clinician Handoff & Safety Boundaries
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance">
            Shared Experience Pack · Patient-Authorized
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Original quotes stay attached unless redacted. Uncertainty remains visible. Zero suggested diagnoses, risk scores, or autonomous treatment verdicts leave the system.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleEncrypt}
            disabled={encrypting}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {encrypting ? 'Encrypting…' : 'Encrypt Enclave (AES-GCM-256)'}
          </button>
          <button
            type="button"
            onClick={handleDownloadFhir}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download FHIR R4
          </button>
        </div>
      </section>

      {/* Main Shared Pack Preview + Granular Consent Controls */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Shared Pack Preview */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                15-Minute Consultation Summary
              </h2>
              <p className="text-xs text-slate-500">
                {mapSignedByPatient
                  ? 'Signed and authorized by patient'
                  : 'Draft preview — awaiting patient signature in Phase 1'}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600">
              Window: {consent.timeWindowDays}d · {visibleNodes.length}/{nodes.length} nodes shared
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Original Voice */}
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-teal-700">
                ORIGINAL VOICE
              </h3>
              <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                {consent.includeOriginalVoice ? (
                  <>
                    <p className="text-sm italic leading-relaxed text-slate-900">
                      “{originalVoice}”
                    </p>
                    <p className="mt-3 text-xs text-slate-500 tabular-nums">
                      Captured {originalCapturedAt} · never overwritten
                    </p>
                  </>
                ) : (
                  <p className="text-xs font-medium text-rose-700">
                    [Redacted by patient granular consent toggle]
                  </p>
                )}
              </div>

              {/* Phase 2 Clinical Lever Summary */}
              <h3 className="mt-5 text-xs font-semibold tracking-wide text-teal-700">
                PHARMACOKINETIC TIMING SIGNAL
              </h3>
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-700 tabular-nums">
                <p>
                  Posterior tmax: <strong className="text-slate-900">{bayesian.posteriorMean}h</strong>{' '}
                  (window {bayesian.windowStart}h–{bayesian.windowEnd}h, {bayesian.confidencePct}% confidence)
                </p>
                <p className="mt-1">
                  14-Day ΔState Filter: <strong className="text-teal-800">{dag.pkPeakCount} coherent PK peaks</strong>{' '}
                  surfaced, {dag.confounderCount} confounder-explained anomalies filtered.
                </p>
                <p className="mt-1">
                  Continuity Status: <strong className="text-slate-900">{dag.silentDriftStatus.replace(/_/g, ' ')}</strong>
                </p>
              </div>
            </div>

            {/* Patient-Verified Nodes */}
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-teal-700">
                PATIENT-VERIFIED NODES
              </h3>
              <div className="mt-2.5 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-4">
                {visibleNodes.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    All dimension nodes are currently redacted by patient consent settings.
                  </p>
                ) : (
                  visibleNodes.map((n) => (
                    <div key={n.id} className="flex items-baseline justify-between gap-4 py-2.5 text-xs">
                      <span className="font-semibold text-slate-900 shrink-0">{n.label}</span>
                      <span className="text-right text-slate-700">
                        {n.summary || '—'}{' '}
                        <span
                          className={`ml-1 font-medium ${
                            n.status === 'uncertain'
                              ? 'text-amber-700'
                              : n.status === 'verified' || n.status === 'partial'
                                ? 'text-teal-700'
                                : 'text-slate-400'
                          }`}
                        >
                          · {n.status === 'uncertain' ? 'explicitly uncertain' : n.status.replace('_', ' ')}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Real Web Crypto AES-GCM-256 Enclave Result */}
          {enclaveCipher && (
            <div className="mt-6 rounded-lg border border-teal-200 bg-teal-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-900">
                  <Shield className="h-4 w-4 text-teal-700" aria-hidden="true" />
                  Air-Gapped On-Device Enclave Encrypted ({enclaveCipher.algorithm})
                </span>
                <span className="font-mono text-[11px] text-teal-800 tabular-nums">
                  {enclaveCipher.byteLength} bytes · key {enclaveCipher.keyFingerprint}
                </span>
              </div>
              <p className="mt-2 break-all font-mono text-[11px] text-slate-700">
                IV (96-bit): {enclaveCipher.ivHex}
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-slate-600">
                Ciphertext: {enclaveCipher.ciphertextBase64.slice(0, 140)}…
              </p>
            </div>
          )}
        </section>

        {/* Granular Consent & Redaction Controls */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Granular Consent & Redaction
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            You choose what leaves the device. Changes update the SMART-on-FHIR bundle immediately.
          </p>

          <div className="mt-4 space-y-4">
            <label className="flex min-h-[40px] cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
              <span className="text-xs font-semibold text-slate-900">
                Include Original Voice Quote
              </span>
              <input
                type="checkbox"
                checked={consent.includeOriginalVoice}
                onChange={(e) =>
                  onUpdateConsent({
                    ...consent,
                    includeOriginalVoice: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-teal-700"
              />
            </label>

            <div>
              <p className="mb-2 text-xs font-medium text-slate-700">Shared Dimension Nodes</p>
              <div className="grid grid-cols-2 gap-2">
                {nodes.map((node) => {
                  const checked = consent.allowedDimensions[node.id];
                  return (
                    <label
                      key={node.id}
                      className={`flex min-h-[38px] cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs ${
                        checked
                          ? 'border-teal-600/50 bg-teal-50/50 text-slate-900'
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      <span className="truncate font-medium">{node.label}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          onUpdateConsent({
                            ...consent,
                            allowedDimensions: {
                              ...consent.allowedDimensions,
                              [node.id]: e.target.checked,
                            },
                          })
                        }
                        className="h-3.5 w-3.5 accent-teal-700"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-700">Time Window Scope</p>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                {([7, 14, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => onUpdateConsent({ ...consent, timeWindowDays: days })}
                    className={`rounded-md py-1.5 text-xs font-medium tabular-nums transition-colors ${
                      consent.timeWindowDays === days
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Shared Decision Pins + SMART-on-FHIR R4 Inspector */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Shared Decision Pins */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Shared Decision Pins (Visit Close)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Solves multi-clinician communication disconnects via revocable read-only tokens.
          </p>

          <div className="mt-4 space-y-3">
            {pins.map((pin) => (
              <div
                key={pin.id}
                className={`rounded-lg border p-3.5 ${
                  pin.revoked
                    ? 'border-slate-200 bg-slate-50 opacity-65'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{pin.title}</p>
                    <p className="mt-0.5 text-[11px] text-teal-700 capitalize">
                      {pin.category.replace(/_/g, ' ')} · {pin.createdAt}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleRevokePin(pin.id)}
                    className={`rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap ${
                      pin.revoked
                        ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        : 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                    }`}
                  >
                    {pin.revoked ? 'Restore Token' : 'Revoke Token'}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-slate-600">{pin.clinicianNote}</p>
                <p className="mt-2 font-mono text-[11px] text-slate-500">
                  Read-only token: {pin.tokenPreview} · {pin.revoked ? 'REVOKED' : 'ACTIVE'}
                </p>
              </div>
            ))}
          </div>

          <form onSubmit={handleCreatePin} className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-800">Confirm New Decision Pin</p>
            <input
              type="text"
              value={pinTitle}
              onChange={(e) => setPinTitle(e.target.value)}
              placeholder="e.g., Shift evening dose +2h after meal..."
              className="min-h-[38px] w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
            />
            <div className="flex gap-2">
              <select
                value={pinCategory}
                onChange={(e) => setPinCategory(e.target.value as DecisionPin['category'])}
                className="min-h-[38px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
              >
                <option value="timing_adjustment">Timing adjustment</option>
                <option value="formulation_review">Formulation review</option>
                <option value="dose_pacing">Dose pacing</option>
                <option value="shared_monitoring">Shared monitoring</option>
              </select>
              <button
                type="submit"
                disabled={!pinTitle.trim()}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-lg bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-500 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add Pin
              </button>
            </div>
            <input
              type="text"
              value={pinNote}
              onChange={(e) => setPinNote(e.target.value)}
              placeholder="Optional shared clinician note..."
              className="min-h-[36px] w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </form>
        </section>

        {/* SMART-on-FHIR R4 Bundle Inspector */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                SMART-on-FHIR R4 Bundle Export
              </h2>
              <p className="text-xs text-slate-500">
                Includes DocumentReference, QuestionnaireResponse, and Bayesian Observation
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyFhir}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
            >
              {copiedFhir ? (
                <>
                  <Check className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                  Copied JSON
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy FHIR JSON
                </>
              )}
            </button>
          </div>

          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-200">
            {fhirJsonString}
          </pre>
        </section>
      </div>

      {/* Strict Non-SaMD Guardrails Banner */}
      <section className="rounded-xl border border-rose-200/80 bg-rose-50/60 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-rose-700 shrink-0" aria-hidden="true" />
          <div className="space-y-1.5">
            <h2 className="font-display text-sm font-bold text-rose-900">
              Strict Non-SaMD Boundary — What This System Does Not Do
            </h2>
            <ul className="space-y-1 text-xs leading-relaxed text-rose-900/90">
              <li>It does not independently diagnose, prescribe, score clinical risk, or replace professional judgment.</li>
              <li>It does not convert subjective experience into predefined ICD/DSM categories.</li>
              <li>Clinical meaning, formulation swaps, dose pacing, and therapeutic authority remain 100% with qualified human clinicians.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};
