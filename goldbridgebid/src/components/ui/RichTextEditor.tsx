"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { useState, useEffect, useRef } from "react";

const PRESET_COLORS = [
  { label: "Default", value: "#000000" },
  { label: "Red", value: "#dc2626" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16a34a" },
  { label: "Orange", value: "#ea580c" },
  { label: "Purple", value: "#9333ea" },
];

interface RichTextEditorProps {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  minHeight?: string;
}

export default function RichTextEditor({
  name,
  defaultValue,
  placeholder,
  minHeight = "10rem",
}: RichTextEditorProps) {
  const [html, setHtml] = useState(defaultValue || "");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
    ],
    content: defaultValue || "",
    onUpdate: ({ editor: ed }) => {
      setHtml(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none px-4 py-2.5 focus:outline-none min-h-[inherit] text-text-primary",
      },
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setColorPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!editor) return null;

  return (
    <div>
      <input type="hidden" name={name} value={html} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-border bg-bg-warm px-2 py-1.5">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <span className="font-bold">B</span>
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <span className="italic">I</span>
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <span className="underline">U</span>
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          title="Heading"
        >
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          title="Sub-heading"
        >
          <span className="text-xs font-bold">H3</span>
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4" cy="6" r="1.5" fill="currentColor" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" />
            <circle cx="4" cy="18" r="1.5" fill="currentColor" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <line x1="10" y1="6" x2="20" y2="6" />
            <line x1="10" y1="12" x2="20" y2="12" />
            <line x1="10" y1="18" x2="20" y2="18" />
            <text
              x="4"
              y="8"
              fontSize="8"
              fill="currentColor"
              stroke="none"
              fontFamily="sans-serif"
            >
              1
            </text>
            <text
              x="4"
              y="14"
              fontSize="8"
              fill="currentColor"
              stroke="none"
              fontFamily="sans-serif"
            >
              2
            </text>
            <text
              x="4"
              y="20"
              fontSize="8"
              fill="currentColor"
              stroke="none"
              fontFamily="sans-serif"
            >
              3
            </text>
          </svg>
        </ToolbarButton>

        <Divider />

        {/* Color picker */}
        <div className="relative" ref={colorRef}>
          <ToolbarButton
            active={colorPickerOpen}
            onClick={() => setColorPickerOpen((prev) => !prev)}
            title="Text color"
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-bold leading-none">A</span>
              <div
                className="h-1 w-4 rounded-full"
                style={{
                  backgroundColor:
                    (editor.getAttributes("textStyle").color as string) ||
                    "#000000",
                }}
              />
            </div>
          </ToolbarButton>

          {colorPickerOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 flex gap-1 rounded-lg border border-border bg-white p-2 shadow-lg">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => {
                    if (c.value === "#000000") {
                      editor.chain().focus().unsetColor().run();
                    } else {
                      editor.chain().focus().setColor(c.value).run();
                    }
                    setColorPickerOpen(false);
                  }}
                  className="h-6 w-6 rounded-full border-2 border-slate-200 transition-transform hover:scale-110"
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div
        className="rounded-b-lg border border-t-0 border-border bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
        style={{ minHeight }}
      >
        <EditorContent
          editor={editor}
          className="[&_.tiptap]:min-h-[inherit] [&_.tiptap]:outline-none"
          style={{ minHeight }}
        />
        {!html && placeholder && (
          <div className="pointer-events-none absolute px-4 py-2.5 text-text-muted">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded px-1.5 text-sm transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-text-secondary hover:bg-slate-200/70"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-border" />;
}
