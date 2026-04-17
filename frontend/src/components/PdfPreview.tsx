import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// Vite-friendly worker import — bundles the worker as a static asset and
// returns its URL. Works in both dev and production builds.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Props {
  file: File | null;
  /** Cap on pages rendered. Avoids massive memory use on long PDFs. */
  maxPages?: number;
}

export function PdfPreview({ file, maxPages = 4 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [renderedPages, setRenderedPages] = useState(0);

  useEffect(() => {
    if (!file || !containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = "";
    setError(null);
    setPageCount(0);
    setRenderedPages(0);

    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;

    (async () => {
      try {
        const buffer = await file.arrayBuffer();
        if (cancelled) return;
        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const total = Math.min(pdf.numPages, maxPages);
        setPageCount(pdf.numPages);

        for (let pageNum = 1; pageNum <= total; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);

          // Fit width to container; cap at 2x devicePixelRatio for crispness.
          const viewport0 = page.getViewport({ scale: 1 });
          const containerWidth = container.clientWidth || 480;
          const scale =
            (containerWidth / viewport0.width) *
            Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          // Render at high DPI but display at logical width.
          canvas.style.width = `${containerWidth}px`;
          canvas.style.height = `${(viewport.height / viewport.width) * containerWidth}px`;
          canvas.className =
            "rounded-lg border border-ink-200 shadow-sm shadow-ink-900/5 mb-3 bg-white";
          container.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          if (cancelled) return;
          setRenderedPages(pageNum);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [file, maxPages]);

  if (!file) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-ink-500">
        <span className="font-semibold tracking-wider uppercase">Preview</span>
        {pageCount > 0 && (
          <span>
            {renderedPages} / {Math.min(pageCount, maxPages)}
            {pageCount > maxPages && ` of ${pageCount}`} pages
          </span>
        )}
      </div>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not render preview: {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="max-h-[80vh] overflow-y-auto rounded-xl border border-ink-200 bg-ink-50 p-3"
        />
      )}
    </div>
  );
}
