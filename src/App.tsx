import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  FileCheck2,
  Map as MapIcon,
  MessageSquareText,
  PhoneCall,
} from 'lucide-react';
import {
  ConfounderTag,
  ConsentSettings,
  DecisionPin,
  DimensionId,
  DimensionNode,
  NodeStatus,
  SomaticChipId,
  SomaticEvent,
  computeBayesianTmax,
  createInitialSeedState,
  detectUncertainties,
  evaluateFourteenDayDag,
} from './engine/mindcareEngine';
import { Phase1ClarifyView } from './components/Phase1ClarifyView';
import { ExperienceStateMapView } from './components/ExperienceStateMapView';
import { Phase2PipelineView } from './components/Phase2PipelineView';
import { ClinicianPackView } from './components/ClinicianPackView';
import { CrisisSafetyModal } from './components/CrisisSafetyModal';

type WorkspaceTab = 'clarify' | 'map' | 'pipeline' | 'handoff';

const STORAGE_KEY = 'mindcare_ai_phase1_state_v1';

interface PersistedState {
  originalVoice: string;
  originalCapturedAt: string;
  nodes: DimensionNode[];
  mapSignedByPatient: boolean;
  mapSignedAt: string | null;
  lastConfirmedTime: string;
  doseConfirmedToday: boolean;
  regimenPriorHours: number;
  activeConfounders: ConfounderTag[];
  hoursPostDose: number;
  events: SomaticEvent[];
  missedDays: number[];
  retroactiveClarifiedDays: number[];
  consent: ConsentSettings;
  pins: DecisionPin[];
}

function loadInitialState(): PersistedState {
  const seed = createInitialSeedState();
  const fallback: PersistedState = {
    originalVoice: seed.initialVoice,
    originalCapturedAt: '28 Aug 2026 · 09:14',
    nodes: seed.initialNodes,
    mapSignedByPatient: false,
    mapSignedAt: null,
    lastConfirmedTime: '08:14 · today',
    doseConfirmedToday: true,
    regimenPriorHours: 2.0,
    activeConfounders: ['with_food'],
    hoursPostDose: 1.8,
    events: seed.initialEvents,
    missedDays: [],
    retroactiveClarifiedDays: [],
    consent: seed.initialConsent,
    pins: seed.initialPins,
  };

  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed.nodes || !parsed.events || !parsed.consent) return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('clarify');
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [state, setState] = useState<PersistedState>(() => loadInitialState());

  const seed = useMemo(() => createInitialSeedState(), []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors in restricted sandboxes
    }
  }, [state]);

  const uncertaintyAnalysis = useMemo(
    () => detectUncertainties(state.originalVoice),
    [state.originalVoice]
  );

  const bayesian = useMemo(
    () =>
      computeBayesianTmax(
        state.events,
        state.regimenPriorHours,
        state.activeConfounders,
        state.hoursPostDose
      ),
    [state.events, state.regimenPriorHours, state.activeConfounders, state.hoursPostDose]
  );

  const dag = useMemo(
    () =>
      evaluateFourteenDayDag(
        state.events,
        bayesian,
        state.missedDays,
        state.retroactiveClarifiedDays
      ),
    [state.events, bayesian, state.missedDays, state.retroactiveClarifiedDays]
  );

  const handleUpdateOriginalVoice = (text: string) => {
    setState((prev) => ({
      ...prev,
      originalVoice: text,
      mapSignedByPatient: false,
    }));
  };

  const handleUpdateNode = (id: DimensionId, summary: string, status: NodeStatus) => {
    setState((prev) => ({
      ...prev,
      mapSignedByPatient: false,
      nodes: prev.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              summary,
              status,
              updatedAt: 'Now',
              patientVerified: status === 'verified' || status === 'partial',
            }
          : n
      ),
    }));
  };

  const handleSignMap = () => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setState((prev) => ({
      ...prev,
      mapSignedByPatient: true,
      mapSignedAt: `Today · ${nowStr}`,
    }));
  };

  const handleResetDemo = () => {
    const freshSeed = createInitialSeedState();
    setState({
      originalVoice: freshSeed.initialVoice,
      originalCapturedAt: '28 Aug 2026 · 09:14',
      nodes: freshSeed.initialNodes,
      mapSignedByPatient: false,
      mapSignedAt: null,
      lastConfirmedTime: '08:14 · today',
      doseConfirmedToday: true,
      regimenPriorHours: 2.0,
      activeConfounders: ['with_food'],
      hoursPostDose: 1.8,
      events: freshSeed.initialEvents,
      missedDays: [],
      retroactiveClarifiedDays: [],
      consent: freshSeed.initialConsent,
      pins: freshSeed.initialPins,
    });
  };

  const handleConfirmDose = () => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setState((prev) => ({
      ...prev,
      doseConfirmedToday: true,
      lastConfirmedTime: `${nowStr} · today`,
      hoursPostDose: 0.3,
    }));
  };

  const handleToggleConfounder = (tag: ConfounderTag) => {
    setState((prev) => {
      const exists = prev.activeConfounders.includes(tag);
      let next = exists
        ? prev.activeConfounders.filter((t) => t !== tag)
        : [...prev.activeConfounders, tag];
      if (tag === 'with_food' && !exists) {
        next = next.filter((t) => t !== 'empty_stomach');
      } else if (tag === 'empty_stomach' && !exists) {
        next = next.filter((t) => t !== 'with_food');
      }
      return { ...prev, activeConfounders: next };
    });
  };

  const handleLogSomaticChip = (chip: SomaticChipId, customLabel?: string) => {
    const label = customLabel || chip;
    const newEvent: SomaticEvent = {
      id: `ev-${Date.now()}`,
      chip,
      label,
      hoursPostDose: state.hoursPostDose,
      timestampIso: new Date().toISOString(),
      confounders: [...state.activeConfounders],
      dayIndex: 13,
    };
    setState((prev) => ({
      ...prev,
      events: [...prev.events, newEvent],
    }));
  };

  const handleToggleSimulateDrift = () => {
    setState((prev) => {
      if (prev.missedDays.length > 0) {
        return { ...prev, missedDays: [], retroactiveClarifiedDays: [] };
      }
      // Remove today's events temporarily if any or flag trailing missed days for Silent Drift check
      return {
        ...prev,
        events: prev.events.filter((e) => e.dayIndex < 11),
        missedDays: [11, 12, 13],
        retroactiveClarifiedDays: [],
      };
    });
  };

  const handleResolveRetroactive = (dayIndex: number, outcome: 'yes' | 'no' | 'uncertain') => {
    setState((prev) => {
      const nextEvents =
        outcome === 'yes'
          ? [
              ...prev.events,
              {
                id: `retro-${Date.now()}`,
                chip: 'foggy_head' as SomaticChipId,
                label: 'Foggy head (retroactive)',
                hoursPostDose: bayesian.posteriorMean,
                timestampIso: new Date().toISOString(),
                confounders: [],
                dayIndex,
              },
            ]
          : prev.events;

      return {
        ...prev,
        events: nextEvents,
        retroactiveClarifiedDays: [...prev.retroactiveClarifiedDays, dayIndex],
      };
    });
  };

  const handleAddPin = (title: string, category: DecisionPin['category'], note: string) => {
    const randomToken = `mc_ro_${Math.random().toString(16).slice(2, 10)}`;
    const newPin: DecisionPin = {
      id: `pin-${Date.now()}`,
      title,
      category,
      clinicianNote: note,
      confirmedByPatient: true,
      createdAt: new Date().toISOString().slice(0, 10),
      tokenPreview: randomToken,
      revoked: false,
    };
    setState((prev) => ({
      ...prev,
      pins: [newPin, ...prev.pins],
    }));
  };

  const handleToggleRevokePin = (id: string) => {
    setState((prev) => ({
      ...prev,
      pins: prev.pins.map((p) => (p.id === id ? { ...p, revoked: !p.revoked } : p)),
    }));
  };

  const switchTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const navItems: { id: WorkspaceTab; label: string; shortLabel: string; icon: typeof MessageSquareText }[] = [
    { id: 'clarify', label: 'Phase 1: Clarify', shortLabel: 'Clarify', icon: MessageSquareText },
    { id: 'map', label: 'State Map', shortLabel: 'Map', icon: MapIcon },
    { id: 'pipeline', label: 'Phase 2: Pipeline', shortLabel: 'Pipeline', icon: Activity },
    { id: 'handoff', label: 'Clinician Pack', shortLabel: 'Handoff', icon: FileCheck2 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-12">
      {/* Top Bar Contract: 3 zones (Brand | 4 single-line nav links | 1 primary action) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => switchTab('clarify')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            MindCare AI
          </button>

          <nav className="hidden md:flex items-center gap-7" aria-label="Primary workspace navigation">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchTab(item.id)}
                  className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-700 ${
                    active ? 'text-teal-800' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute right-0 -bottom-3.5 left-0 h-0.5 bg-teal-700" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setCrisisOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
              Crisis Support
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'clarify' && (
          <Phase1ClarifyView
            originalVoice={state.originalVoice}
            onUpdateOriginalVoice={handleUpdateOriginalVoice}
            analysis={uncertaintyAnalysis}
            nodes={state.nodes}
            onUpdateNode={handleUpdateNode}
            mapSignedByPatient={state.mapSignedByPatient}
            mapSignedAt={state.mapSignedAt}
            onSignMap={handleSignMap}
            onResetToUncertain={handleResetDemo}
            onOpenMapTab={() => switchTab('map')}
          />
        )}

        {activeTab === 'map' && (
          <ExperienceStateMapView
            originalVoice={state.originalVoice}
            originalCapturedAt={state.originalCapturedAt}
            nodes={state.nodes}
            timeline={seed.initialTimeline}
            mapSignedByPatient={state.mapSignedByPatient}
            onUpdateNode={handleUpdateNode}
          />
        )}

        {activeTab === 'pipeline' && (
          <Phase2PipelineView
            lastConfirmedTime={state.lastConfirmedTime}
            doseConfirmedToday={state.doseConfirmedToday}
            onConfirmDose={handleConfirmDose}
            regimenPriorHours={state.regimenPriorHours}
            onChangeRegimenPrior={(hrs) => setState((prev) => ({ ...prev, regimenPriorHours: hrs }))}
            activeConfounders={state.activeConfounders}
            onToggleConfounder={handleToggleConfounder}
            hoursPostDose={state.hoursPostDose}
            onChangeHoursPostDose={(hrs) => setState((prev) => ({ ...prev, hoursPostDose: hrs }))}
            bayesian={bayesian}
            events={state.events}
            onLogSomaticChip={handleLogSomaticChip}
            dag={dag}
            missedDays={state.missedDays}
            onToggleSimulateDrift={handleToggleSimulateDrift}
            onResolveRetroactive={handleResolveRetroactive}
          />
        )}

        {activeTab === 'handoff' && (
          <ClinicianPackView
            originalVoice={state.originalVoice}
            originalCapturedAt={state.originalCapturedAt}
            nodes={state.nodes}
            bayesian={bayesian}
            dag={dag}
            consent={state.consent}
            onUpdateConsent={(next) => setState((prev) => ({ ...prev, consent: next }))}
            pins={state.pins}
            onAddPin={handleAddPin}
            onToggleRevokePin={handleToggleRevokePin}
            mapSignedByPatient={state.mapSignedByPatient}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="mx-auto max-w-7xl border-t border-slate-200 px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            MindCare AI · Non-diagnostic, Non-SaMD outpatient communication & side-effect continuity infrastructure
          </p>
          <p>Don&apos;t Interpret, Clarify · 100% clinical authority retained by human clinicians</p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation (< md only, compact height <= 15% cap) */}
      <nav
        className="fixed right-0 bottom-0 left-0 z-40 grid h-14 grid-cols-4 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden"
        aria-label="Mobile workspace navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active ? 'text-teal-700' : 'text-slate-500'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      <CrisisSafetyModal open={crisisOpen} onClose={() => setCrisisOpen(false)} />
    </div>
  );
}
