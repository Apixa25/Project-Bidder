"use client";

import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { stopImpersonation } from "@/app/(dashboard)/admin/actions";

interface ImpersonationBannerProps {
  userName: string;
  userRole: string;
}

export default function ImpersonationBanner({
  userName,
  userRole,
}: ImpersonationBannerProps) {
  const router = useRouter();

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-900 shadow-md">
      <Eye className="h-4 w-4 shrink-0" />
      <span>
        Viewing as <strong>{userName}</strong> ({userRole}) — read-only mode
      </span>
      <button
        onClick={async () => {
          await stopImpersonation();
          router.push("/admin/users");
          router.refresh();
        }}
        className="inline-flex items-center gap-1 rounded-lg bg-amber-900 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800 transition-colors"
      >
        <X className="h-3 w-3" />
        Exit
      </button>
    </div>
  );
}
