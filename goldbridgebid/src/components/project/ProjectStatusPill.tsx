import type { ProjectStatus } from "@/types/database";

// Centralized project status pill. The previous inline implementation lived
// in 4+ files as a 3-way ternary (open / awarded / else→Closed) which
// silently mislabeled "completed" projects as "Closed" and used the same
// gray treatment for both states. Routing every render through this
// component keeps colors and labels consistent everywhere and gives
// "completed" its own distinct look.

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; classes: string }
> = {
  open: { label: "Open", classes: "bg-green-100 text-green-700" },
  awarded: { label: "Awarded", classes: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", classes: "bg-blue-100 text-blue-700" },
  closed: { label: "Closed", classes: "bg-gray-100 text-gray-600" },
};

const FALLBACK_CONFIG = {
  classes: "bg-gray-100 text-gray-600",
};

interface ProjectStatusPillProps {
  // Accept the typed status, but also accept a raw string for places where
  // the data shape is loose (admin queries that select status as a string,
  // print pages, etc.). Unknown values get a Title-Cased label and the
  // neutral gray treatment.
  status: ProjectStatus | string | null | undefined;
  // sm = the default ~22px pill used in lists
  // md = the larger ~28px pill used in page headers
  size?: "sm" | "md";
  className?: string;
}

export default function ProjectStatusPill({
  status,
  size = "sm",
  className = "",
}: ProjectStatusPillProps) {
  const safeStatus = (status || "").toString();
  const config =
    (STATUS_CONFIG as Record<string, { label: string; classes: string }>)[
      safeStatus
    ] ?? {
      label: safeStatus
        ? safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1)
        : "Unknown",
      classes: FALLBACK_CONFIG.classes,
    };

  const sizeClasses =
    size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.classes} ${sizeClasses} ${className}`.trim()}
    >
      {config.label}
    </span>
  );
}

// Helper for the few places (admin/projects/[id]) that need the color
// classes without the pill wrapper itself. Keeps the color mapping in
// exactly one file.
export function getProjectStatusColorClasses(
  status: ProjectStatus | string | null | undefined
) {
  const safeStatus = (status || "").toString();
  return (
    (STATUS_CONFIG as Record<string, { label: string; classes: string }>)[
      safeStatus
    ]?.classes ?? FALLBACK_CONFIG.classes
  );
}
