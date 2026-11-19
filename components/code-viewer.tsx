"use client";

import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import type { BundledLanguage } from "shiki";

export function CodeViewer({
  code,
  fileName,
  language,
}: {
  code: string;
  fileName: string;
  language?: string;
}) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function highlight() {
      const { codeToHtml } = await import("shiki");
      const inferredLanguage = language ?? fileName.split(".").pop()?.toLowerCase() ?? "text";
      let result: string;
      try {
        result = await codeToHtml(code, {
          lang: inferredLanguage as BundledLanguage,
          theme: "dark-plus",
        });
      } catch {
        result = await codeToHtml(code, { lang: "text", theme: "dark-plus" });
      }
      if (active) setHtml(DOMPurify.sanitize(result));
    }
    void highlight();
    return () => { active = false; };
  }, [code, fileName, language]);

  if (!html) return <pre className="code-viewer min-h-full">{code}</pre>;
  return <div className="code-viewer code-viewer-highlighted min-h-full" dangerouslySetInnerHTML={{ __html: html }} />;
}
