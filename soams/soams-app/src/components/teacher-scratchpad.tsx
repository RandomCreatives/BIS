'use client';

import { useState } from 'react';
import { StickyNote, X, Eraser } from 'lucide-react';

const STORAGE_KEY = 'soams-scratchpad';

function readDraft(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

// Mounted only while open (parent gates it), so the draft is re-read fresh.
export function TeacherScratchpad({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState(readDraft);

  function save(v: string) {
    setText(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* storage unavailable */
    }
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <aside
      className="fixed right-0 top-0 z-40 flex h-full w-full max-w-sm flex-col border-l border-line bg-white shadow-2xl"
      role="complementary"
      aria-label="Teacher scratchpad"
    >
      <div className="flex items-center justify-between border-b border-line bg-bone px-4 py-3">
        <span className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink/70">
          <StickyNote className="h-4 w-4 text-brand-500" />
          Teacher Scratchpad
        </span>
        <button
          onClick={onClose}
          aria-label="Close scratchpad"
          className="rounded-md border border-line bg-white p-1.5 text-ink/50 transition hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="mb-3 font-mono text-[10px] leading-relaxed text-ink/50">
          Attached to your current class view — log continuous notes, daily
          reminders, and student observations. Autosaved in this browser.
        </p>
        <textarea
          value={text}
          onChange={(e) => save(e.target.value)}
          placeholder="e.g. Alemu showed strong focus in science today…"
          autoFocus
          className="min-h-[40vh] flex-1 resize-none rounded-lg border border-line bg-bone p-3 text-sm leading-relaxed text-ink outline-none placeholder:text-ink/35 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[10px] text-ink/45">{words} words</span>
          <button
            onClick={() => save('')}
            className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink/60 transition hover:border-red-300 hover:text-red-600"
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>
    </aside>
  );
}
