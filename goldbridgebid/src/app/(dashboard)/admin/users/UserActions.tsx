"use client";

import { useState } from "react";
import { ShieldOff, ShieldCheck, Trash2 } from "lucide-react";
import {
  banUser,
  unbanUser,
  deleteUser,
} from "@/app/(dashboard)/admin/actions";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface UserActionsProps {
  userId: string;
  userName: string;
  isBanned: boolean;
}

export default function UserActions({
  userId,
  userName,
  isBanned,
}: UserActionsProps) {
  const [showBan, setShowBan] = useState(false);
  const [showUnban, setShowUnban] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1">
        {isBanned ? (
          <button
            onClick={() => setShowUnban(true)}
            title="Unban user"
            className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 transition-colors"
          >
            <ShieldCheck className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setShowBan(true)}
            title="Ban user"
            className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <ShieldOff className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => setShowDelete(true)}
          title="Delete user"
          className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <ConfirmDialog
        open={showBan}
        onClose={() => setShowBan(false)}
        onConfirm={async (reason) => {
          await banUser(userId, reason);
        }}
        title={`Ban ${userName}`}
        description="This user will be immediately blocked from accessing the platform. They will see a suspension message on their next visit."
        confirmLabel="Ban User"
        confirmColor="amber"
        showReasonInput
        reasonRequired
      />

      <ConfirmDialog
        open={showUnban}
        onClose={() => setShowUnban(false)}
        onConfirm={async () => {
          await unbanUser(userId);
        }}
        title={`Unban ${userName}`}
        description="This will restore the user's access to the platform."
        confirmLabel="Unban User"
        confirmColor="amber"
      />

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={async () => {
          await deleteUser(userId);
        }}
        title={`Delete ${userName}`}
        description="This will permanently delete the user's account, profile, and all associated data. This action CANNOT be undone."
        confirmLabel="Delete Permanently"
        confirmColor="red"
      />
    </>
  );
}
