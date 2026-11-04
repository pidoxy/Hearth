"use client";
import { useActionState } from "react";
import { acceptInvite } from "../../actions";
import { FormError, SubmitButton } from "@/components/submit";

export function JoinForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvite, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormError error={state?.error} />
      <SubmitButton pendingText="Joining…">Join household</SubmitButton>
    </form>
  );
}
