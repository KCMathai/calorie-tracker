"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

const REVEAL_MS = 1000;
const DOT = "•";

/** Touch phones already flash each typed character in native password fields, so we only emulate it elsewhere. */
function useIsTouchDevice() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(pointer: coarse)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}

/**
 * Password field with a show/hide button. On computers, each newly typed
 * character stays visible for a second before turning into a dot.
 */
export function PasswordInput({
  value,
  onChange,
  className = "",
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [visible, setVisible] = useState(false);
  const [revealAt, setRevealAt] = useState<number | null>(null);
  const isTouch = useIsTouchDevice();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCaret = useRef<number | null>(null);

  // On computers we draw the dots ourselves so one character can stay readable.
  const customMask = !visible && !isTouch;
  const display = visible
    ? value
    : customMask
      ? value.replace(/[\s\S]/g, (ch, i: number) => (i === revealAt ? ch : DOT))
      : value;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Keep the cursor where the user was typing after we re-mask the text.
  useLayoutEffect(() => {
    if (pendingCaret.current !== null && inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  });

  function reveal(index: number | null) {
    if (timer.current) clearTimeout(timer.current);
    setRevealAt(index);
    if (index !== null) {
      timer.current = setTimeout(() => {
        // Re-masking replaces the text, which would otherwise throw the cursor to the end.
        const el = inputRef.current;
        if (el && document.activeElement === el) pendingCaret.current = el.selectionStart;
        setRevealAt(null);
      }, REVEAL_MS);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    if (!customMask) {
      onChange(next);
      return;
    }
    // Work out what changed between the dotted text and what the browser now shows.
    // The dots all look alike, so the cursor position pins down where the edit happened:
    // everything after the cursor is unchanged, and the edit ends at the cursor.
    const caret = e.target.selectionStart ?? next.length;
    const end = Math.min(next.length - caret, display.length);
    let start = 0;
    while (start < caret && start < display.length - end && display[start] === next[start]) start++;
    const inserted = next.slice(start, caret);
    const real = value.slice(0, start) + inserted + value.slice(value.length - end);
    onChange(real);
    pendingCaret.current = start + inserted.length;
    reveal(inserted.length === 1 ? start : null);
  }

  return (
    <div className={`field flex min-w-0 items-center gap-1 !py-0 pr-1 ${className}`}>
      <input
        ref={inputRef}
        {...rest}
        type={customMask || visible ? "text" : "password"}
        value={display}
        onChange={handleChange}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent py-2 outline-none"
      />
      <button
        type="button"
        onClick={() => {
          setVisible((v) => !v);
          reveal(null);
        }}
        aria-label={visible ? "Hide passcode" : "Show passcode"}
        aria-pressed={visible}
        title={visible ? "Hide passcode" : "Show passcode"}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-[var(--surface-hover)]"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  );
}
