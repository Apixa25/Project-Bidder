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
} from "lucide-react";

type Tool = "pen" | "arrow" | "rect" | "circle" | "text" | "line";

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
}

interface PhotoAnnotatorProps {
  imageUrl: string;
  fileId: string;
  onSave: (fileId: string, blob: Blob) => Promise<void>;
  onClose: () => void;
}

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ffffff"];
const STROKE_WIDTHS = [2, 4, 6];

export default function PhotoAnnotator({
  imageUrl,
  fileId,
  onSave,
  onClose,
}: PhotoAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);

  const isDrawing = useRef(false);
  const currentAnnotation = useRef<Annotation | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);

  const genId = () => Math.random().toString(36).slice(2, 10);

  // Load background image onto main canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;

      const container = containerRef.current;
      if (!container) return;

      const maxW = container.clientWidth;
      const maxH = container.clientHeight;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      scaleRef.current = scale;

      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      if (!canvas || !overlay) return;

      canvas.width = w;
      canvas.height = h;
      overlay.width = w;
      overlay.height = h;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
      }

      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const redrawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    for (const ann of annotations) {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = ann.strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (ann.tool) {
        case "pen": {
          if (!ann.points || ann.points.length < 4) break;
          ctx.beginPath();
          ctx.moveTo(ann.points[0], ann.points[1]);
          for (let i = 2; i < ann.points.length; i += 2) {
            ctx.lineTo(ann.points[i], ann.points[i + 1]);
          }
          ctx.stroke();
          break;
        }
        case "line": {
          if (ann.x == null || ann.y == null || ann.endX == null || ann.endY == null) break;
          ctx.beginPath();
          ctx.moveTo(ann.x, ann.y);
          ctx.lineTo(ann.endX, ann.endY);
          ctx.stroke();
          break;
        }
        case "arrow": {
          if (ann.x == null || ann.y == null || ann.endX == null || ann.endY == null) break;
          const dx = ann.endX - ann.x;
          const dy = ann.endY - ann.y;
          const angle = Math.atan2(dy, dx);
          const headLen = 12 + ann.strokeWidth * 2;

          ctx.beginPath();
          ctx.moveTo(ann.x, ann.y);
          ctx.lineTo(ann.endX, ann.endY);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(ann.endX, ann.endY);
          ctx.lineTo(
            ann.endX - headLen * Math.cos(angle - Math.PI / 6),
            ann.endY - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            ann.endX - headLen * Math.cos(angle + Math.PI / 6),
            ann.endY - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
          break;
        }
        case "rect": {
          if (ann.x == null || ann.y == null || ann.width == null || ann.height == null) break;
          ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
          break;
        }
        case "circle": {
          if (ann.x == null || ann.y == null || ann.radius == null) break;
          ctx.beginPath();
          ctx.arc(ann.x, ann.y, ann.radius, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "text": {
          if (ann.x == null || ann.y == null || !ann.text) break;
          const fontSize = 14 + ann.strokeWidth * 3;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 3;
          ctx.strokeText(ann.text, ann.x, ann.y);
          ctx.fillStyle = ann.color;
          ctx.fillText(ann.text, ann.x, ann.y);
          break;
        }
      }
    }
  }, [annotations]);

  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay]);

  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool === "text") {
      const pos = getPos(e);
      setTextPos(pos);
      return;
    }

    isDrawing.current = true;
    const pos = getPos(e);
    const ann: Annotation = {
      id: genId(),
      tool,
      color,
      strokeWidth,
    };

    if (tool === "pen") {
      ann.points = [pos.x, pos.y];
    } else if (tool === "arrow" || tool === "line") {
      ann.x = pos.x;
      ann.y = pos.y;
      ann.endX = pos.x;
      ann.endY = pos.y;
    } else if (tool === "rect") {
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

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current || !currentAnnotation.current) return;
    const pos = getPos(e);
    const ann = currentAnnotation.current;

    if (ann.tool === "pen" && ann.points) {
      ann.points.push(pos.x, pos.y);
    } else if ((ann.tool === "arrow" || ann.tool === "line") && ann.x != null && ann.y != null) {
      ann.endX = pos.x;
      ann.endY = pos.y;
    } else if (ann.tool === "rect" && ann.x != null && ann.y != null) {
      ann.width = pos.x - ann.x;
      ann.height = pos.y - ann.y;
    } else if (ann.tool === "circle" && ann.x != null && ann.y != null) {
      const dx = pos.x - ann.x;
      const dy = pos.y - ann.y;
      ann.radius = Math.sqrt(dx * dx + dy * dy);
    }

    // Live preview: draw current annotations + in-progress annotation
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Redraw all finalized annotations
    for (const a of annotations) {
      drawAnnotation(ctx, a);
    }
    // Draw in-progress annotation
    drawAnnotation(ctx, ann);
  }

  function handleMouseUp() {
    if (!isDrawing.current || !currentAnnotation.current) return;
    isDrawing.current = false;
    const finished = { ...currentAnnotation.current };
    if (finished.points) {
      finished.points = [...finished.points];
    }
    currentAnnotation.current = null;
    setAnnotations((prev) => [...prev, finished]);
  }

  function drawAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation) {
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = ann.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (ann.tool) {
      case "pen": {
        if (!ann.points || ann.points.length < 4) break;
        ctx.beginPath();
        ctx.moveTo(ann.points[0], ann.points[1]);
        for (let i = 2; i < ann.points.length; i += 2) {
          ctx.lineTo(ann.points[i], ann.points[i + 1]);
        }
        ctx.stroke();
        break;
      }
      case "line": {
        if (ann.x == null || ann.y == null || ann.endX == null || ann.endY == null) break;
        ctx.beginPath();
        ctx.moveTo(ann.x, ann.y);
        ctx.lineTo(ann.endX, ann.endY);
        ctx.stroke();
        break;
      }
      case "arrow": {
        if (ann.x == null || ann.y == null || ann.endX == null || ann.endY == null) break;
        const dx = ann.endX - ann.x;
        const dy = ann.endY - ann.y;
        const angle = Math.atan2(dy, dx);
        const headLen = 12 + ann.strokeWidth * 2;

        ctx.beginPath();
        ctx.moveTo(ann.x, ann.y);
        ctx.lineTo(ann.endX, ann.endY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(ann.endX, ann.endY);
        ctx.lineTo(
          ann.endX - headLen * Math.cos(angle - Math.PI / 6),
          ann.endY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          ann.endX - headLen * Math.cos(angle + Math.PI / 6),
          ann.endY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "rect": {
        if (ann.x == null || ann.y == null || ann.width == null || ann.height == null) break;
        ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
        break;
      }
      case "circle": {
        if (ann.x == null || ann.y == null || ann.radius == null) break;
        ctx.beginPath();
        ctx.arc(ann.x, ann.y, ann.radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "text": {
        if (ann.x == null || ann.y == null || !ann.text) break;
        const fontSize = 14 + ann.strokeWidth * 3;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.strokeText(ann.text, ann.x, ann.y);
        ctx.fillStyle = ann.color;
        ctx.fillText(ann.text, ann.x, ann.y);
        break;
      }
    }
  }

  function handleTextSubmit() {
    if (!textPos || !textInput.trim()) {
      setTextPos(null);
      setTextInput("");
      return;
    }

    setAnnotations((prev) => [
      ...prev,
      {
        id: genId(),
        tool: "text",
        color,
        strokeWidth,
        x: textPos.x,
        y: textPos.y,
        text: textInput.trim(),
      },
    ]);
    setTextPos(null);
    setTextInput("");
  }

  function handleUndo() {
    setAnnotations((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setAnnotations([]);
  }

  async function handleSave() {
    if (!canvasRef.current || !overlayRef.current || !imgRef.current) return;

    setSaving(true);

    // Compose final image at full resolution
    const img = imgRef.current;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = img.width;
    exportCanvas.height = img.height;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);

    // Scale annotations up from display size to original size
    const upscale = 1 / scaleRef.current;

    for (const ann of annotations) {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = ann.strokeWidth * upscale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (ann.tool) {
        case "pen": {
          if (!ann.points || ann.points.length < 4) break;
          ctx.beginPath();
          ctx.moveTo(ann.points[0] * upscale, ann.points[1] * upscale);
          for (let i = 2; i < ann.points.length; i += 2) {
            ctx.lineTo(ann.points[i] * upscale, ann.points[i + 1] * upscale);
          }
          ctx.stroke();
          break;
        }
        case "line": {
          if (ann.x == null || ann.y == null || ann.endX == null || ann.endY == null) break;
          ctx.beginPath();
          ctx.moveTo(ann.x * upscale, ann.y * upscale);
          ctx.lineTo(ann.endX * upscale, ann.endY * upscale);
          ctx.stroke();
          break;
        }
        case "arrow": {
          if (ann.x == null || ann.y == null || ann.endX == null || ann.endY == null) break;
          const dx = ann.endX - ann.x;
          const dy = ann.endY - ann.y;
          const angle = Math.atan2(dy, dx);
          const headLen = (12 + ann.strokeWidth * 2) * upscale;

          ctx.beginPath();
          ctx.moveTo(ann.x * upscale, ann.y * upscale);
          ctx.lineTo(ann.endX * upscale, ann.endY * upscale);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(ann.endX * upscale, ann.endY * upscale);
          ctx.lineTo(
            ann.endX * upscale - headLen * Math.cos(angle - Math.PI / 6),
            ann.endY * upscale - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            ann.endX * upscale - headLen * Math.cos(angle + Math.PI / 6),
            ann.endY * upscale - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
          break;
        }
        case "rect": {
          if (ann.x == null || ann.y == null || ann.width == null || ann.height == null) break;
          ctx.strokeRect(
            ann.x * upscale,
            ann.y * upscale,
            ann.width * upscale,
            ann.height * upscale
          );
          break;
        }
        case "circle": {
          if (ann.x == null || ann.y == null || ann.radius == null) break;
          ctx.beginPath();
          ctx.arc(ann.x * upscale, ann.y * upscale, ann.radius * upscale, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "text": {
          if (ann.x == null || ann.y == null || !ann.text) break;
          const fontSize = (14 + ann.strokeWidth * 3) * upscale;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 3 * upscale;
          ctx.strokeText(ann.text, ann.x * upscale, ann.y * upscale);
          ctx.fillStyle = ann.color;
          ctx.fillText(ann.text, ann.x * upscale, ann.y * upscale);
          break;
        }
      }
    }

    exportCanvas.toBlob(
      async (blob) => {
        if (blob) {
          try {
            await onSave(fileId, blob);
          } catch {
            // Error handled by parent
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
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gray-800 px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Tools */}
          <div className="flex items-center gap-1 rounded-lg bg-gray-700 p-1">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={t.label}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  tool === t.id
                    ? "bg-primary text-white"
                    : "text-gray-300 hover:text-white hover:bg-gray-600"
                }`}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Colors */}
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  color === c ? "border-white scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Stroke Width */}
          <div className="flex items-center gap-1 rounded-lg bg-gray-700 p-1">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setStrokeWidth(w)}
                title={`${w}px`}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  strokeWidth === w
                    ? "bg-primary text-white"
                    : "text-gray-300 hover:text-white hover:bg-gray-600"
                }`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{ width: w + 2, height: w + 2 }}
                />
              </button>
            ))}
          </div>

          {/* Undo / Clear */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={annotations.length === 0}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-30"
            >
              <Undo2 className="h-4 w-4" />
              <span className="hidden sm:inline">Undo</span>
            </button>
            <button
              onClick={handleClear}
              disabled={annotations.length === 0}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || annotations.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-500 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save Annotation"}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-hidden p-4"
      >
        {!imageLoaded && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading image...
          </div>
        )}
        <div className="relative" style={{ display: imageLoaded ? "block" : "none" }}>
          <canvas ref={canvasRef} className="rounded-lg" />
          <canvas
            ref={overlayRef}
            className="absolute top-0 left-0 rounded-lg"
            style={{ cursor: tool === "text" ? "text" : "crosshair" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          {/* Text Input Overlay */}
          {textPos && (
            <div
              className="absolute"
              style={{ left: textPos.x, top: textPos.y - 36 }}
            >
              <div className="flex items-center gap-1 rounded-lg bg-white shadow-lg p-1">
                <input
                  autoFocus
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTextSubmit();
                    if (e.key === "Escape") {
                      setTextPos(null);
                      setTextInput("");
                    }
                  }}
                  placeholder="Type label..."
                  className="rounded-md border-none bg-gray-100 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleTextSubmit}
                  className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-dark transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setTextPos(null);
                    setTextInput("");
                  }}
                  className="rounded-md px-1.5 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="border-t border-white/10 bg-gray-800 px-4 py-2 text-center text-xs text-gray-500">
        {tool === "text"
          ? "Click anywhere on the image to place a text label"
          : "Click and drag to draw. Annotations are saved at full resolution."}
      </div>
    </div>
  );
}
