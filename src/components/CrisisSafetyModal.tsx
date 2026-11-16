import React from 'react';
import { Phone, ShieldAlert, X } from 'lucide-react';

interface CrisisSafetyModalProps {
  open: boolean;
  onClose: () => void;
}

export const CrisisSafetyModal: React.FC<CrisisSafetyModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crisis-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-rose-700" aria-hidden="true" />
            <h2 id="crisis-modal-title" className="font-display text-lg font-bold text-slate-900">
              Immediate Crisis & Safety Resources
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close crisis resources"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          MindCare AI is a non-diagnostic communication map and does not monitor or manage acute psychiatric emergencies. If you feel unsafe or in acute distress, connect directly with a human crisis responder now:
        </p>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50/70 p-3.5">
            <div>
              <p className="text-sm font-semibold text-slate-900">Tele-MANAS (India 24/7 Mental Health Helpline)</p>
              <p className="text-xs text-slate-600">Free, confidential multilingual support</p>
            </div>
            <a
              href="tel:14416"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-800 whitespace-nowrap"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              Call 14416
            </a>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div>
              <p className="text-sm font-semibold text-slate-900">988 Suicide & Crisis Lifeline (US/Canada)</p>
              <p className="text-xs text-slate-600">Call or text 988 anytime</p>
            </div>
            <a
              href="tel:988"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              Call 988
            </a>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div>
              <p className="text-sm font-semibold text-slate-900">Local Emergency Services</p>
              <p className="text-xs text-slate-600">Immediate medical or safety response</p>
            </div>
            <a
              href="tel:112"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 whitespace-nowrap"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              Call 112 / 911
            </a>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Return to Map
          </button>
        </div>
      </div>
    </div>
  );
};
