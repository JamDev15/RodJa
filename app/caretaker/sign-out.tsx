"use client";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/login" })} className="min-h-9 shrink-0 px-1 text-xs text-th-faint hover:text-th-ink">
      Sign out
    </button>
  );
}
