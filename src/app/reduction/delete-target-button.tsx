"use client";

import { useActionState } from "react";
import { deleteTarget } from "@/actions/reduction";
import { Button } from "@/components/ui/button";

export function DeleteTargetButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deleteTarget, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="xs"
        disabled={pending}
        className="text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          if (!confirm("確定要刪除此減碳目標嗎？")) {
            e.preventDefault();
          }
        }}
      >
        {pending ? "刪除中..." : "刪除"}
      </Button>
      {state && "error" in state && (
        <p className="text-xs text-destructive mt-1">{state.error}</p>
      )}
    </form>
  );
}
