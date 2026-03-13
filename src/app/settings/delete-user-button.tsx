"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { deleteUser, type SettingsState } from "@/actions/settings";

export function DeleteUserButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [state, formAction, isPending] = useActionState<SettingsState, FormData>(deleteUser, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <Button
        type="submit"
        variant="ghost"
        size="xs"
        className="text-destructive hover:text-destructive"
        disabled={isPending}
        onClick={(e) => {
          if (!confirm(`確定要刪除使用者「${userName}」嗎？`)) {
            e.preventDefault();
          }
        }}
      >
        {isPending ? "刪除中..." : "刪除"}
      </Button>
      {state?.error && (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      )}
    </form>
  );
}
