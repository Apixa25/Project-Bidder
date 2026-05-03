"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Pencil,
  ArrowUpRight,
  Square,
  Circle,
  Type,
  Undo2,
  Trash2,
  Save,
  Loader2,
  Minus,
  CheckCircle2,
  ArrowLeft,
  Hand,
  Hash,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Highlighter,
} from "lucide-react";

type Tool =
  | "pen"
  | "arrow"
  | "rect"
  | "circle"
  | "text"
  | "line"
  | "callout"
  | "redact";

type InteractionMode = "annotate" | "navigate";

type RedactStyle = "solid" | "blur";

interface Annotation {
  id: string;
  tool: Tool;
  color: string;
  strokeWidth: number;
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  endX?: number;
  endY?: number;
  radius?: number;
  dashed?: boolean;
  /** Semi-transparent markup (pen / line / arrow stroke; rect & circle filled). */
  highlight?: boolean;
  calloutNum?: number;
  /** Caption label below numbered badge (newline + word wrap when drawn). */
  caption?: string;
  blurRedact?: boolean;
  fontSizePx?: number;
  textBackdrop?: boolean;
}

interface PhotoAnnotatorProps {
  imageUrl: string;
  fileId: string;
  onSave: (fileId: string, blob: Blob) => Promise<void>;
  onClose: () => void;
}

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ffffff"];
const STROKE_WIDTHS = [2, 4, 6];
const FONT_SIZES = [14, 18, 22, 26, 30, 36];
const NAV_ZOOM_MIN = 0.35;
const NAV_ZOOM_MAX = 6;
const HIGHLIGHT_ALPHA = 0.38;

function normalizeRect(
  x: number,
  y: number,
  w: number,
  h: number
): { x: number; y: number; w: number; h: number } {
  const left = x + Math.min(w, 0);
  const top = y + Math.min(h, 0);
  return {
    x: left,
    y: top,
    w: Math.abs(w),
    h: Math.abs(h),
  };
}

function calloutBadgeRadius(strokeWLayout: number, coordsMultiplier: number) {
  return Math.max(16, 10 + strokeWLayout * 2.5) * coordsMultiplier;
}

function drawCalloutBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  num: number,
  accentColor: string,
  strokeWLayout: number,
  coordsMultiplier: number
) {
  const r = calloutBadgeRadius(strokeWLayout, coordsMultiplier);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = Math.max(2 * coordsMultiplier, strokeWLayout * coordsMultiplier);
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.font = `bold ${Math.round(r * 0.98)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = accentColor;
  ctx.globalAlpha = 1;
  ctx.fillText(String(num), cx, cy + coordsMultiplier);
  ctx.restore();
}

/** Numbered-dot caption stack (multi-line); drawn below badge center `cy`. */
function drawCalloutCaptionBlock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cyBadge: number,
  captionRaw: string,
  accentColor: string,
  strokeWLayout: number,
  coordsMultiplier: number
) {
  const trimmed = captionRaw.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return;

  const r = calloutBadgeRadius(strokeWLayout, coordsMultiplier);
  const gap = Math.max(6 * coordsMultiplier, r * 0.12);
  const fontCap = Math.max(11 * coordsMultiplier, Math.min(r * 0.36, 20 * coordsMultiplier));

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.font = `bold ${fontCap}px sans-serif`;

  const maxWrap = Math.max(90 * coordsMultiplier, ctx.canvas.width * 0.36);
  const lines = buildCanvasTextLines(ctx, trimmed, maxWrap);

  let maxLineW = 0;
  for (const ln of lines) {
    if (!ln) continue;
    maxLineW = Math.max(maxLineW, ctx.measureText(ln).width);
  }

  const lineSkip = fontCap * 1.22;
  const probe = lines.find((ln) => ln !== "") ?? "Mg";
  const probeM = ctx.measureText(probe);
  const ascent = probeM.actualBoundingBoxAscent || fontCap * 0.75;
  const nonLines = lines.filter((ln) => ln !== "");
  const lastLineSample = nonLines[nonLines.length - 1] ?? probe;
  const descent = ctx.measureText(lastLineSample).actualBoundingBoxDescent ?? fontCap * 0.22;

  const pad = Math.max(4 * coordsMultiplier, fontCap * 0.28);
  const firstBaseline = cyBadge + r + gap + ascent;
  const bx = cx - maxLineW / 2 - pad;
  const bw = maxLineW + pad * 2;
  const by = firstBaseline - ascent - pad;
  const bh =
    ascent +
    descent +
    pad * 2 +
    (lines.length > 1 ? (lines.length - 1) * lineSkip : 0);

  const rr = Math.min(10 * coordsMultiplier, Math.max(fontCap * 0.33, bh * 0.1));

  ctx.fillStyle = "rgba(18,18,24,0.88)";
  ctx.strokeStyle = "rgba(250,250,250,0.45)";
  ctx.lineWidth = Math.max(coordsMultiplier * 1.5, fontCap * 0.05);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(bx + rr, by);
  ctx.lineTo(bx + bw - rr, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + rr, rr);
  ctx.lineTo(bx + bw, by + bh - rr);
  ctx.arcTo(bx + bw, by + bh, bx + bw - rr, by + bh, rr);
  ctx.lineTo(bx + rr, by + bh);
  ctx.arcTo(bx, by + bh, bx, by + bh - rr, rr);
  ctx.lineTo(bx, by + rr);
  ctx.arcTo(bx, by, bx + rr, by, rr);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(coordsMultiplier * 2.2, fontCap * 0.08);

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const yLine = firstBaseline + i * lineSkip;
    const lineX = cx - maxLineW / 2;
    if (ln === "") continue;
    ctx.strokeText(ln, lineX, yLine);
    ctx.fillStyle = accentColor;
    ctx.fillText(ln, lineX, yLine);
  }
  ctx.restore();
}

function resetCtxVisual(ctx: CanvasRenderingContext2D) {
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.filter = "none";
}

/** Fits a single paragraph into lines using ctx.measureText (requires ctx.font to be set). */
function wrapParagraphToLines(
  ctx: CanvasRenderingContext2D,
  paragraph: string,
  maxWidth: number
): string[] {
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let line = "";

  function finishOversizedWord(word: string) {
    let chunk = "";
    for (const ch of word) {
      const cand = chunk + ch;
      if (ctx.measureText(cand).width <= maxWidth) chunk = cand;
      else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    line = chunk;
  }

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
      continue;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
    } else {
      finishOversizedWord(word);
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Honors manual line breaks (\n); wraps each segment to roughly half the canvas width. */
function buildCanvasTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWrapWidth: number
): string[] {
  const segments = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === "") {
      out.push("");
      continue;
    }
    out.push(...wrapParagraphToLines(ctx, seg, maxWrapWidth));
  }
  return out;
}

/**
 * Renders annotations; coordsMultiplier = 1 for on-screen canvases or 1/upscaleBitmap for export bitmap.
 */
function drawAnnotationOnContext(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  coordsMultiplier: number,
  sourcePhoto: HTMLCanvasElement | HTMLImageElement | null,
  blurPx: number,
  overlayPreviewSolidRedactOnly = false
) {
  const sw = ann.strokeWidth * coordsMultiplier;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = sw;
  ctx.strokeStyle = ann.color;
  ctx.fillStyle = ann.color;
  ctx.setLineDash(
    ann.dashed ? [Math.max(4 * coordsMultiplier, 3), Math.max(3 * coordsMultiplier, 2)] : []
  );

  const hi = Boolean(ann.highlight);

  switch (ann.tool) {
    case "pen": {
      if (!ann.points || ann.points.length < 4) break;
      ctx.globalAlpha = hi ? HIGHLIGHT_ALPHA : 1;
      ctx.beginPath();
      ctx.moveTo(ann.points[0] * coordsMultiplier, ann.points[1] * coordsMultiplier);
      for (let i = 2; i < ann.points.length; i += 2) {
        ctx.lineTo(ann.points[i] * coordsMultiplier, ann.points[i + 1] * coordsMultiplier);
      }
      ctx.stroke();
      break;
    }
    case "line": {
      if (ann.x == null || ann.y == null || ann.endX == null || ann.endY == null) break;
      ctx.globalAlpha = hi ? HIGHLIGHT_ALPHA : 1;
      ctx.beginPath();
      ctx.moveTo(ann.x * coordsMultiplier, ann.y * coordsMultiplier);
      ctx.lineTo(ann.endX * coordsMultiplier, ann.endY * coordsMultiplier);
      ctx.stroke();
      break;
    }
    case "arrow": {
      if (ann.x == null || ann.y == null || ann.endX == null || ann.endY == null) break;
      const ax = ann.x * coordsMultiplier;
      const ay = ann.y * coordsMultiplier;
      const ex = ann.endX * coordsMultiplier;
      const ey = ann.endY * coordsMultiplier;
      const dx = ex - ax;
      const dy = ey - ay;
      const angle = Math.atan2(dy, dx);
      const headLen = (12 + ann.strokeWidth * 2) * coordsMultiplier;
      ctx.globalAlpha = hi ? HIGHLIGHT_ALPHA : 1;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(
        ex - headLen * Math.cos(angle - Math.PI / 6),
        ey - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        ex - headLen * Math.cos(angle + Math.PI / 6),
        ey - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "rect": {
      if (ann.x == null || ann.y == null || ann.width == null || ann.height == null) break;
      const x = ann.x * coordsMultiplier;
      const y = ann.y * coordsMultiplier;
      const w = ann.width * coordsMultiplier;
      const h = ann.height * coordsMultiplier;
      if (hi) {
        ctx.globalAlpha = HIGHLIGHT_ALPHA;
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.globalAlpha = 1;
        ctx.strokeRect(x, y, w, h);
      }
      break;
    }
    case "circle": {
      if (ann.x == null || ann.y == null || ann.radius == null) break;
      ctx.beginPath();
      ctx.arc(
        ann.x * coordsMultiplier,
        ann.y * coordsMultiplier,
        ann.radius * coordsMultiplier,
        0,
        Math.PI * 2
      );
      if (hi) {
        ctx.globalAlpha = HIGHLIGHT_ALPHA;
        ctx.fill();
      } else {
        ctx.globalAlpha = 1;
        ctx.stroke();
      }
      break;
    }
    case "text": {
      if (ann.x == null || ann.y == null || !ann.text) break;
      const fontSize = (ann.fontSizePx ?? 14 + ann.strokeWidth * 3) * coordsMultiplier;
      ctx.globalAlpha = 1;
      ctx.font = `bold ${fontSize}px sans-serif`;
      const maxWrapWidth = Math.max(fontSize * 6, ctx.canvas.width * 0.48);
      const lines = buildCanvasTextLines(ctx, ann.text, maxWrapWidth);

      let maxLineW = 0;
      for (const ln of lines) {
        if (!ln) continue;
        maxLineW = Math.max(maxLineW, ctx.measureText(ln).width);
      }

      const lineSkip = fontSize * 1.26;
      const pad = Math.max(4, fontSize * 0.28);
      const baseX = ann.x * coordsMultiplier;
      const baseY = ann.y * coordsMultiplier;

      const probe = lines.find((ln) => ln !== "") ?? "Mg";
      const probeM = ctx.measureText(probe);
      const ascent = probeM.actualBoundingBoxAscent || fontSize * 0.75;
      const descent = probeM.actualBoundingBoxDescent || fontSize * 0.22;

      if (ann.textBackdrop) {
        const bh =
          ascent + descent + pad * 2 + (lines.length > 1 ? (lines.length - 1) * lineSkip : 0);
        const bw = maxLineW + pad * 2;
        const bx = baseX - pad;
        const by = baseY - ascent - pad;

        const r = Math.min(10 * coordsMultiplier, Math.max(fontSize * 0.33, bh * 0.12));
        ctx.fillStyle = "rgba(24,24,27,0.82)";
        ctx.strokeStyle = "rgba(250,250,250,0.55)";
        ctx.lineWidth = Math.max(coordsMultiplier * 2, fontSize * 0.06);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + bw - r, by);
        ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
        ctx.lineTo(bx + bw, by + bh - r);
        ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
        ctx.lineTo(bx + r, by + bh);
        ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
        ctx.lineTo(bx, by + r);
        ctx.arcTo(bx, by, bx + r, by, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = Math.max(coordsMultiplier * 3, fontSize * 0.09);
      ctx.setLineDash([]);

      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        const yLine = baseY + i * lineSkip;
        if (ln === "") continue;
        ctx.strokeText(ln, baseX, yLine);
        ctx.fillStyle = ann.color;
        ctx.fillText(ln, baseX, yLine);
      }
      break;
    }
    case "callout": {
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      if (ann.x == null || ann.y == null || ann.calloutNum == null) break;
      const swLayout = ann.strokeWidth;
      const cx = ann.x * coordsMultiplier;
      const cy = ann.y * coordsMultiplier;
      drawCalloutBadge(ctx, cx, cy, ann.calloutNum, ann.color, swLayout, coordsMultiplier);
      if (ann.caption?.trim())
        drawCalloutCaptionBlock(ctx, cx, cy, ann.caption, ann.color, swLayout, coordsMultiplier);
      break;
    }
    case "redact": {
      ctx.globalAlpha = 1;
      if (
        ann.x == null ||
        ann.y == null ||
        ann.width == null ||
        ann.height == null ||
        !sourcePhoto
      ) {
        break;
      }
      const { x, y, w, h } = normalizeRect(
        ann.x * coordsMultiplier,
        ann.y * coordsMultiplier,
        ann.width * coordsMultiplier,
        ann.height * coordsMultiplier
      );
      if (w < 1 || h < 1) break;

      if (ann.blurRedact && overlayPreviewSolidRedactOnly) {
        ctx.setLineDash([6 * coordsMultiplier, 5 * coordsMultiplier]);
        ctx.strokeStyle = "rgba(250,204,21,0.85)";
        ctx.lineWidth = Math.max(coordsMultiplier * 2, 2);
        ctx.strokeRect(x, y, w, h);
        resetCtxVisual(ctx);
        break;
      }

      if (ann.blurRedact) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.filter = `blur(${blurPx}px)`;
        ctx.drawImage(
          sourcePhoto,
          0,
          0,
          sourcePhoto.width,
          sourcePhoto.height,
          0,
          0,
          ctx.canvas.width,
          ctx.canvas.height
        );
        ctx.restore();
        resetCtxVisual(ctx);
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = Math.max(coordsMultiplier * 2, 2);
        ctx.setLineDash([6 * coordsMultiplier, 5 * coordsMultiplier]);
        ctx.strokeRect(x, y, w, h);
      } else {
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(18,18,24,0.94)";
        ctx.fillRect(x, y, w, h);
      }
      break;
    }
  }

  resetCtxVisual(ctx);
}

function pinchDistance(points: Map<number, { cx: number; cy: number }>) {
  if (points.size < 2) return 0;
  const vals = [...points.values()];
  const p0 = vals[0];
  const p1 = vals[1];
  return Math.hypot(p0.cx - p1.cx, p0.cy - p1.cy);
}

export default function PhotoAnnotator({
  imageUrl,
  fileId,
  onSave,
  onClose,
}: PhotoAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);

  /** Callout in progress — click confirms anchor, then caption is entered inline. */
  const [calloutDraft, setCalloutDraft] = useState<{ x: number; y: number; num: number } | null>(
    null
  );
  const [calloutCaptionInput, setCalloutCaptionInput] = useState("");

  const [interactionMode, setInteractionMode] = useState<InteractionMode>("annotate");
  const [viewScale, setViewScale] = useState(1);
  const [viewPanX, setViewPanX] = useState(0);
  const [viewPanY, setViewPanY] = useState(0);

  const [markupHighlight, setMarkupHighlight] = useState(false);
  const [strokeDashed, setStrokeDashed] = useState(false);
  const [redactStyle, setRedactStyle] = useState<RedactStyle>("solid");
  const [textFontSize, setTextFontSize] = useState(22);
  const [textUseBackdrop, setTextUseBackdrop] = useState(true);
  const [blurStrengthPx, setBlurStrengthPx] = useState(14);

  const isDrawing = useRef(false);
  const currentAnnotation = useRef<Annotation | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);
  const viewScaleRef = useRef(1);

  const navDragging = useRef(false);
  const navLast = useRef({ x: 0, y: 0 });

  /** Active pointers during navigate (viewport client coordinates). */
  const viewportPointers = useRef(new Map<number, { cx: number; cy: number }>());
  /** Baseline pinch: distance at two-finger start and scale at that moment. */
  const pinchBase = useRef<{ dist: number; scale: number } | null>(null);

  const genId = () => Math.random().toString(36).slice(2, 10);

  useEffect(() => {
    viewScaleRef.current = viewScale;
  }, [viewScale]);

  function layoutImageToCanvases() {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const img = imgRef.current;
    if (!container || !canvas || !overlay || !img?.complete) return;

    const maxW = container.clientWidth;
    const maxH = container.clientHeight;
    const layoutScale = Math.min(maxW / img.width, maxH / img.height, 1);
    scaleRef.current = layoutScale;

    const w = Math.round(img.width * layoutScale);
    const h = Math.round(img.height * layoutScale);
    const nextBlurStrengthPx = Math.max(10, Math.min(img.width, img.height) * 0.014);

    setBlurStrengthPx((current) =>
      current === nextBlurStrengthPx ? current : nextBlurStrengthPx
    );

    canvas.width = w;
    canvas.height = h;
    overlay.width = w;
    overlay.height = h;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(img, 0, 0, w, h);
  }

  // Load photo
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      requestAnimationFrame(() => {
        layoutImageToCanvases();
        setImageLoaded(true);
      });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const redrawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    for (const ann of annotations) {
      drawAnnotationOnContext(ctx, ann, 1, canvas, blurStrengthPx);
    }
  }, [annotations, blurStrengthPx]);

  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        layoutImageToCanvases();
        redrawOverlay();
      }, 80);
    });
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [imageLoaded, redrawOverlay]);

  // Wheel zoom needs non-passive listener to allow preventDefault when navigating or ctrl-zooming.
  useEffect(() => {
    const v = viewportRef.current;
    if (!v || !imageLoaded) return;

    function onWheel(e: WheelEvent) {
      const nav = interactionMode === "navigate";
      const zoomChord = nav || e.ctrlKey;
      if (!zoomChord) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.002);
      setViewScale((s) =>
        Math.min(NAV_ZOOM_MAX, Math.max(NAV_ZOOM_MIN, s * factor))
      );
    }

    v.addEventListener("wheel", onWheel, { passive: false });
    return () => v.removeEventListener("wheel", onWheel);
  }, [interactionMode, imageLoaded]);

  function getCanvasPos(clientX: number, clientY: number) {
    const overlay = overlayRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    const sx = overlay.width / rect.width;
    const sy = overlay.height / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }

  function discardCalloutDraft() {
    setCalloutDraft(null);
    setCalloutCaptionInput("");
  }

  function handleCalloutCaptionSubmit() {
    if (!calloutDraft) return;
    const cap = calloutCaptionInput.replace(/\r\n/g, "\n").trim();

    const entry: Annotation = {
      id: genId(),
      tool: "callout",
      color,
      strokeWidth,
      dashed: false,
      highlight: false,
      calloutNum: calloutDraft.num,
      x: calloutDraft.x,
      y: calloutDraft.y,
    };
    if (cap) entry.caption = cap;

    setSaved(false);
    setAnnotations((prev) => [...prev, entry]);
    discardCalloutDraft();
  }

  function annotateCommonFields(): Pick<Annotation, "color" | "strokeWidth" | "dashed" | "highlight"> {
    return {
      color,
      strokeWidth,
      dashed:
        strokeDashed &&
        (tool === "pen" ||
          tool === "line" ||
          tool === "arrow" ||
          tool === "rect" ||
          tool === "circle"),
      highlight:
        markupHighlight &&
        (tool === "pen" ||
          tool === "line" ||
          tool === "arrow" ||
          tool === "rect" ||
          tool === "circle"),
    };
  }

  function handleAnnotatePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (interactionMode !== "annotate") return;
    e.preventDefault();
    overlayRef.current?.setPointerCapture(e.pointerId);

    const pos = getCanvasPos(e.clientX, e.clientY);

    if (tool === "text") {
      discardCalloutDraft();
      setTextPos(pos);
      return;
    }

    if (tool === "callout") {
      setSaved(false);
      setTextPos(null);

      if (calloutDraft) {
        setCalloutDraft({ ...calloutDraft, x: pos.x, y: pos.y });
        return;
      }

      const nums = annotations
        .filter((a): a is Annotation & { calloutNum: number } =>
          Boolean(a.tool === "callout" && a.calloutNum != null))
        .map((a) => a.calloutNum);
      const num = nums.length ? Math.max(...nums) + 1 : 1;
      setCalloutDraft({ x: pos.x, y: pos.y, num });
      setCalloutCaptionInput("");
      return;
    }

    discardCalloutDraft();
    setTextPos(null);
    setTextInput("");

    isDrawing.current = true;
    const fields = annotateCommonFields();
    const ann: Annotation = {
      id: genId(),
      tool,
      color: fields.color,
      strokeWidth: fields.strokeWidth,
      dashed: fields.dashed,
      highlight: fields.highlight,
      blurRedact: tool === "redact" ? redactStyle === "blur" : undefined,
    };

    if (tool === "pen") {
      ann.points = [pos.x, pos.y];
    } else if (tool === "arrow" || tool === "line") {
      ann.x = pos.x;
      ann.y = pos.y;
      ann.endX = pos.x;
      ann.endY = pos.y;
    } else if (tool === "rect" || tool === "redact") {
      ann.x = pos.x;
      ann.y = pos.y;
      ann.width = 0;
      ann.height = 0;
    } else if (tool === "circle") {
      ann.x = pos.x;
      ann.y = pos.y;
      ann.radius = 0;
    }

    currentAnnotation.current = ann;
  }

  function redrawWithCurrent(ann: Annotation | null) {
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    for (const a of annotations) {
      drawAnnotationOnContext(ctx, a, 1, canvas, blurStrengthPx);
    }
    if (ann) {
      const previewBlurAsBox =
        ann.tool === "redact" && ann.blurRedact === true ? true : false;
      drawAnnotationOnContext(ctx, ann, 1, canvas, blurStrengthPx, previewBlurAsBox);
    }
  }

  function handleAnnotatePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (interactionMode !== "annotate") return;
    if (!isDrawing.current || !currentAnnotation.current) return;

    const pos = getCanvasPos(e.clientX, e.clientY);
    const cur = currentAnnotation.current;

    if (cur.tool === "pen" && cur.points) {
      cur.points.push(pos.x, pos.y);
    } else if (
      (cur.tool === "arrow" || cur.tool === "line") &&
      cur.x != null &&
      cur.y != null
    ) {
      cur.endX = pos.x;
      cur.endY = pos.y;
    } else if (
      (cur.tool === "rect" || cur.tool === "redact") &&
      cur.x != null &&
      cur.y != null
    ) {
      cur.width = pos.x - cur.x;
      cur.height = pos.y - cur.y;
    } else if (cur.tool === "circle" && cur.x != null && cur.y != null) {
      cur.radius = Math.hypot(pos.x - cur.x, pos.y - cur.y);
    }

    redrawWithCurrent(cur);
  }

  function handleAnnotatePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (interactionMode !== "annotate") return;
    try {
      overlayRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      //
    }

    if (!isDrawing.current || !currentAnnotation.current) return;

    const finishedRaw = currentAnnotation.current;
    isDrawing.current = false;

    let finished = { ...finishedRaw };
    if (finished.points) {
      finished = { ...finished, points: [...finished.points] };
    }

    // Drop empty shapes
    if (finished.tool === "pen") {
      if (!finished.points || finished.points.length < 4) {
        currentAnnotation.current = null;
        redrawWithCurrent(null);
        return;
      }
    }
    if (finished.tool === "arrow" || finished.tool === "line") {
      if (
        finished.x == null ||
        finished.y == null ||
        finished.endX == null ||
        finished.endY == null ||
        (finished.endX === finished.x && finished.endY === finished.y)
      ) {
        currentAnnotation.current = null;
        redrawWithCurrent(null);
        return;
      }
    }
    if (finished.tool === "rect") {
      if (
        finished.width == null ||
        finished.height == null ||
        Math.abs(finished.width) < 4 ||
        Math.abs(finished.height) < 4
      ) {
        currentAnnotation.current = null;
        redrawWithCurrent(null);
        return;
      }
    }
    if (finished.tool === "circle") {
      if (
        finished.radius == null ||
        finished.radius < 4
      ) {
        currentAnnotation.current = null;
        redrawWithCurrent(null);
        return;
      }
    }
    if (finished.tool === "redact") {
      if (
        finished.width == null ||
        finished.height == null ||
        Math.abs(finished.width) < 8 ||
        Math.abs(finished.height) < 8
      ) {
        currentAnnotation.current = null;
        redrawWithCurrent(null);
        return;
      }
    }

    currentAnnotation.current = null;
    setSaved(false);
    setAnnotations((prev) => [...prev, finished]);
  }

  function handleNavigatePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (interactionMode !== "navigate") return;
    e.preventDefault();
    viewportRef.current?.setPointerCapture(e.pointerId);
    viewportPointers.current.set(e.pointerId, {
      cx: e.clientX,
      cy: e.clientY,
    });

    const m = viewportPointers.current;
    if (m.size === 1) {
      pinchBase.current = null;
      navDragging.current = true;
      navLast.current = { x: e.clientX, y: e.clientY };
      return;
    }

    navDragging.current = false;
    if (m.size >= 2) {
      pinchBase.current = {
        dist: pinchDistance(m),
        scale: viewScaleRef.current,
      };
    }
  }

  function handleNavigatePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (interactionMode !== "navigate") return;

    const m = viewportPointers.current;
    if (!m.has(e.pointerId)) return;
    m.set(e.pointerId, { cx: e.clientX, cy: e.clientY });

    if (m.size >= 2 && pinchBase.current) {
      const d = pinchDistance(m);
      if (d > 8 && pinchBase.current.dist > 8) {
        const ratio = d / pinchBase.current.dist;
        const next = pinchBase.current.scale * ratio;
        setViewScale(Math.min(NAV_ZOOM_MAX, Math.max(NAV_ZOOM_MIN, next)));
      }
      return;
    }

    if (m.size !== 1) return;

    if (navDragging.current) {
      const dx = e.clientX - navLast.current.x;
      const dy = e.clientY - navLast.current.y;
      navLast.current = { x: e.clientX, y: e.clientY };
      setViewPanX((p) => p + dx);
      setViewPanY((py) => py + dy);
    }
  }

  function handleNavigatePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (interactionMode !== "navigate") return;

    viewportPointers.current.delete(e.pointerId);
    if (viewportPointers.current.size === 0) {
      pinchBase.current = null;
      navDragging.current = false;
    } else if (viewportPointers.current.size === 1) {
      pinchBase.current = null;
      navDragging.current = true;
      const left = [...viewportPointers.current.values()][0];
      navLast.current = { x: left.cx, y: left.cy };
    }
    try {
      viewportRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      //
    }
  }

  function handleTextSubmit() {
    if (!textPos) return;
    const text = textInput.replace(/\r\n/g, "\n").trim();
    if (!text) {
      setTextPos(null);
      setTextInput("");
      return;
    }

    setSaved(false);
    setAnnotations((prev) => [
      ...prev,
      {
        id: genId(),
        tool: "text",
        color,
        strokeWidth,
        dashed: false,
        highlight: false,
        x: textPos.x,
        y: textPos.y,
        text,
        fontSizePx: textFontSize,
        textBackdrop: textUseBackdrop,
      },
    ]);
    setTextPos(null);
    setTextInput("");
  }

  function handleUndo() {
    setSaved(false);
    setAnnotations((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setSaved(false);
    setAnnotations([]);
  }

  function resetViewport() {
    setViewScale(1);
    setViewPanX(0);
    setViewPanY(0);
    viewportPointers.current.clear();
    pinchBase.current = null;
    navDragging.current = false;
  }

  async function handleSave() {
    if (!canvasRef.current || !imgRef.current) return;

    setSaving(true);

    const img = imgRef.current;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = img.width;
    exportCanvas.height = img.height;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) {
      setSaving(false);
      return;
    }

    ctx.drawImage(img, 0, 0);
    const upscale = 1 / scaleRef.current;

    for (const ann of annotations) {
      drawAnnotationOnContext(ctx, ann, upscale, img, blurStrengthPx, false);
    }

    exportCanvas.toBlob(
      async (blob) => {
        if (blob) {
          try {
            await onSave(fileId, blob);
            setSaved(true);
          } catch {
            //
          }
        }
        setSaving(false);
      },
      "image/png",
      1
    );
  }

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "pen", icon: <Pencil className="h-4 w-4" />, label: "Pen" },
    { id: "arrow", icon: <ArrowUpRight className="h-4 w-4" />, label: "Arrow" },
    { id: "line", icon: <Minus className="h-4 w-4" />, label: "Line" },
    { id: "rect", icon: <Square className="h-4 w-4" />, label: "Rectangle" },
    { id: "circle", icon: <Circle className="h-4 w-4" />, label: "Circle" },
    { id: "text", icon: <Type className="h-4 w-4" />, label: "Text" },
    { id: "callout", icon: <Hash className="h-4 w-4" />, label: "Callout" },
    { id: "redact", icon: <EyeOff className="h-4 w-4" />, label: "Redact" },
  ];

  const showStrokeToggles =
    tool === "pen" ||
    tool === "line" ||
    tool === "arrow" ||
    tool === "rect" ||
    tool === "circle";

  const showRedactModes = tool === "redact";
  const showTextExtras = tool === "text";

  const footerHint =
    interactionMode === "navigate"
      ? "Move / zoom mode: drag to pan, pinch with two fingers to zoom, Ctrl+wheel to zoom."
      : tool === "text"
        ? "Click to place text. Enter for new lines; long lines wrap. Ctrl+Enter or Add inserts the label."
        : tool === "callout"
          ? "Click anchor for numbered badge — add caption below (multi-line OK). Click again before adding to reposition. Badge-only allowed if caption is blank."
          : tool === "redact"
            ? "Drag to place a blur or opaque patch (choose above). Exported image uses full-resolution blur/fill."
            : "Annotate mode: click and drag. Toggle Move / zoom when you need to pan dense photos.";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      <div className="flex flex-shrink-0 flex-col gap-2 border-b border-white/10 bg-gray-800 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-gray-700 p-1">
            <button
              type="button"
              onClick={() => setInteractionMode("annotate")}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                interactionMode === "annotate"
                  ? "bg-primary text-slate-950"
                  : "text-gray-300 hover:bg-gray-600 hover:text-white"
              }`}
            >
              Annotate
            </button>
            <button
              type="button"
              onClick={() => {
                discardCalloutDraft();
                setInteractionMode("navigate");
              }}
              title="Pan and zoom photo"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                interactionMode === "navigate"
                  ? "bg-primary text-slate-950"
                  : "text-gray-300 hover:bg-gray-600 hover:text-white"
              }`}
            >
              <Hand className="h-4 w-4" />
              <span className="hidden sm:inline">Move / zoom</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-700 p-1">
            {tools.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => {
                  setInteractionMode("annotate");
                  if (t.id !== "callout") discardCalloutDraft();
                  setTool(t.id);
                }}
                title={t.label}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                  tool === t.id && interactionMode === "annotate"
                    ? "bg-primary text-slate-950"
                    : "text-gray-300 hover:bg-gray-600 hover:text-white"
                }`}
              >
                {t.icon}
                <span className="hidden lg:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {showStrokeToggles && (
            <>
              <div className="flex items-center rounded-lg bg-gray-700 p-0.5">
                <button
                  type="button"
                  title="Translucent markup"
                  onClick={() => setMarkupHighlight((v) => !v)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                    markupHighlight
                      ? "bg-primary text-slate-950"
                      : "text-gray-300 hover:bg-gray-600 hover:text-white"
                  }`}
                >
                  <Highlighter className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Hi</span>
                </button>
              </div>
              <button
                type="button"
                title="Dashed strokes"
                onClick={() => setStrokeDashed((v) => !v)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  strokeDashed
                    ? "bg-primary text-slate-950"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
                }`}
              >
                Dashed
              </button>
            </>
          )}

          {showRedactModes && (
            <div className="flex items-center gap-0.5 rounded-lg bg-gray-700 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setRedactStyle("blur")}
                className={`rounded-md px-2 py-1 ${
                  redactStyle === "blur"
                    ? "bg-primary text-slate-950"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                Blur
              </button>
              <button
                type="button"
                onClick={() => setRedactStyle("solid")}
                className={`rounded-md px-2 py-1 ${
                  redactStyle === "solid"
                    ? "bg-primary text-slate-950"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                Solid
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  color === c ? "scale-110 border-white" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-gray-700 p-1">
            {STROKE_WIDTHS.map((w) => (
              <button
                type="button"
                key={w}
                onClick={() => setStrokeWidth(w)}
                title={`${w}px stroke`}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  strokeWidth === w
                    ? "bg-primary text-slate-950"
                    : "text-gray-300 hover:bg-gray-600 hover:text-white"
                }`}
              >
                <span
                  className="rounded-full bg-current"
                  style={{ width: w + 2, height: w + 2 }}
                />
              </button>
            ))}
          </div>

          {showTextExtras && (
            <>
              <label className="flex items-center gap-1 text-xs text-gray-300">
                Size
                <select
                  value={textFontSize}
                  onChange={(e) => setTextFontSize(Number(e.target.value))}
                  className="rounded-md border-0 bg-gray-600 px-1.5 py-1 font-medium text-white"
                >
                  {FONT_SIZES.map((fs) => (
                    <option key={fs} value={fs}>
                      {fs}px
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-1 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={textUseBackdrop}
                  onChange={(e) => setTextUseBackdrop(e.target.checked)}
                  className="accent-primary rounded"
                />
                Text bg
              </label>
            </>
          )}

          <div className="flex items-center gap-1 rounded-lg bg-gray-700 p-0.5">
            <button
              type="button"
              title="Zoom out"
              className="rounded-md p-1.5 text-gray-300 hover:bg-gray-600 hover:text-white"
              onClick={() =>
                setViewScale((s) =>
                  Math.max(NAV_ZOOM_MIN, s / 1.18)
                )
              }
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span
              className="min-w-[3rem] text-center tabular-nums text-xs font-semibold text-gray-100"
              title="Zoom vs. fitted size"
              aria-live="polite"
            >
              {Math.round(viewScale * 100)}%
            </span>
            <button
              type="button"
              title="Zoom in"
              className="rounded-md p-1.5 text-gray-300 hover:bg-gray-600 hover:text-white"
              onClick={() =>
                setViewScale((s) =>
                  Math.min(NAV_ZOOM_MAX, s * 1.18)
                )
              }
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Reset pan & zoom"
              className="px-2 py-1 text-xs font-medium text-gray-300 hover:text-white"
              onClick={resetViewport}
            >
              Reset view
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={annotations.length === 0}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-30"
            >
              <Undo2 className="h-4 w-4" />
              <span className="hidden sm:inline">Undo</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={annotations.length === 0}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || annotations.length === 0 || saved}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save Annotation"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`flex items-center gap-1 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              saved
                ? "bg-primary text-slate-950 hover:bg-primary/90"
                : "border border-white/20 text-gray-300 hover:bg-gray-700 hover:text-white"
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
            {saved ? "Done" : "Cancel"}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        {!imageLoaded && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading image...
          </div>
        )}

        {/* Navigate layer (above artwork for reliable pan/zoom) */}
        {imageLoaded && (
          <div
            ref={viewportRef}
            className={`absolute inset-0 z-40 touch-none ${
              interactionMode === "navigate"
                ? "cursor-grab active:cursor-grabbing"
                : "pointer-events-none"
            }`}
            onPointerDown={handleNavigatePointerDown}
            onPointerMove={handleNavigatePointerMove}
            onPointerUp={handleNavigatePointerUp}
            onPointerCancel={handleNavigatePointerUp}
            aria-hidden={interactionMode !== "navigate"}
          />
        )}

        {imageLoaded && (
          <div
            role="status"
            aria-live="polite"
            title="Relative to fitted photo size after loading"
            className="pointer-events-none absolute bottom-5 right-5 z-[45] rounded-lg border border-white/15 bg-black/55 px-2.5 py-1 text-xs font-semibold tabular-nums tracking-tight text-white shadow-lg backdrop-blur-sm"
          >
            {Math.round(viewScale * 100)}%
          </div>
        )}

        <div
          className="relative z-30 max-h-full max-w-full"
          style={{
            transform: `translate(${viewPanX}px, ${viewPanY}px) scale(${viewScale})`,
            transformOrigin: "center center",
            display: imageLoaded ? "inline-block" : "none",
            touchAction: interactionMode === "annotate" ? "none" : "auto",
          }}
        >
          <div className="relative">
            <canvas ref={canvasRef} className="block rounded-lg" />
            <canvas
              ref={overlayRef}
              className="absolute left-0 top-0 rounded-lg select-none"
              style={{
                pointerEvents: interactionMode === "annotate" ? "auto" : "none",
                cursor:
                  interactionMode !== "annotate"
                    ? "default"
                    : tool === "text"
                      ? "text"
                      : tool === "callout"
                        ? "copy"
                        : "crosshair",
              }}
              onPointerDown={handleAnnotatePointerDown}
              onPointerMove={handleAnnotatePointerMove}
              onPointerUp={handleAnnotatePointerUp}
              onPointerLeave={handleAnnotatePointerUp}
              onPointerCancel={handleAnnotatePointerUp}
            />

            {textPos && interactionMode === "annotate" && (
              <div
                className="absolute z-50"
                style={{
                  left: textPos.x,
                  top: Math.max(4, textPos.y - 8),
                  transformOrigin: "left top",
                }}
              >
                <div className="flex flex-col gap-1.5 rounded-lg bg-white p-2 shadow-lg sm:max-w-[min(420px,calc(100vw-56px))] sm:min-w-[240px] max-w-[min(92vw,calc(100vw-56px))] w-[92vw] sm:w-auto">
                  <textarea
                    autoFocus
                    rows={5}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setTextPos(null);
                        setTextInput("");
                      }
                      if (e.key === "Enter" && e.ctrlKey) {
                        e.preventDefault();
                        handleTextSubmit();
                      }
                    }}
                    placeholder={`Line one…${"\n"}Enter = new line · Ctrl+Enter = Add`}
                    className="w-full min-h-[5.25rem] resize-y rounded-md border border-gray-200 bg-gray-100 px-2 py-1.5 text-sm leading-snug text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={handleTextSubmit}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-slate-950 hover:bg-primary-dark transition-colors"
                    >
                      Add
                    </button>
                    <span className="hidden text-[10px] text-gray-500 sm:inline">
                      Ctrl+Enter
                    </span>
                    <button
                      type="button"
                      className="rounded-md px-1.5 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => {
                        setTextPos(null);
                        setTextInput("");
                      }}
                      aria-label="Cancel text"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {calloutDraft && interactionMode === "annotate" && (
              <div
                className="absolute z-[51]"
                style={{
                  left: calloutDraft.x,
                  top: Math.max(4, calloutDraft.y - 8),
                  transformOrigin: "left top",
                }}
              >
                <div className="flex flex-col gap-2 rounded-lg border border-amber-500/35 bg-gray-950 p-2.5 shadow-xl sm:max-w-[min(420px,calc(100vw-56px))] sm:min-w-[260px] max-w-[min(92vw,calc(100vw-56px))] w-[92vw] sm:w-auto">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                    <span className="text-xs font-bold text-amber-400">
                      Callout {calloutDraft.num}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      Click image again = move anchor
                    </span>
                  </div>
                  <textarea
                    autoFocus
                    rows={4}
                    value={calloutCaptionInput}
                    onChange={(e) => setCalloutCaptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") discardCalloutDraft();
                      if (e.key === "Enter" && e.ctrlKey) {
                        e.preventDefault();
                        handleCalloutCaptionSubmit();
                      }
                    }}
                    placeholder={`e.g. Rot along bottom edge…${"\n"}Enter = new line · Ctrl+Enter = Add`}
                    className="w-full min-h-[4rem] resize-y rounded-md border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm leading-snug text-gray-100 placeholder:text-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[10px] text-gray-500">
                      Caption optional — leave blank for number only.
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleCalloutCaptionSubmit}
                        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-slate-950 hover:bg-primary-dark transition-colors"
                      >
                        Add callout
                      </button>
                      <span className="hidden text-[10px] text-gray-500 sm:inline">Ctrl+Enter</span>
                      <button
                        type="button"
                        className="rounded-md px-1.5 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        onClick={() => discardCalloutDraft()}
                        aria-label="Cancel callout"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-white/10 bg-gray-800 px-4 py-2 text-center text-xs text-gray-500">
        {footerHint} · Final PNG uses full image resolution.
      </div>
    </div>
  );
}
