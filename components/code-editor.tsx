"use client";

import { useRef } from "react";

export function CodeEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const lineCount = value.split("\n").length;

  function handleScroll(event: React.UIEvent<HTMLTextAreaElement>) {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = value.slice(0, start) + "  " + value.slice(end);
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.selectionStart = start + 2;
      textarea.selectionEnd = start + 2;
    });
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden border border-border bg-code-bg">
      <div
        ref={lineNumbersRef}
        aria-hidden="true"
        className="docs-scroll w-12 shrink-0 overflow-hidden border-r border-border py-3 pr-3 text-right font-mono text-[13px] leading-6 text-muted select-none"
      >
        {Array.from({ length: lineCount }, (_, index) => (
          <div key={index}>{index + 1}</div>
        ))}
      </div>
      <textarea
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        className="docs-scroll h-full min-h-0 min-w-0 flex-1 resize-none overflow-auto bg-transparent px-4 py-3 font-mono text-[13px] leading-6 text-code-foreground outline-none"
        placeholder={placeholder}
        aria-label="Code editor"
      />
    </div>
  );
}
