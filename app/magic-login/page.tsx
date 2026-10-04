"use client";
import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function MagicLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("This login link is missing its token.");
      return;
    }
    signIn("magic-link", { token, redirect: false }).then((result) => {
      if (result?.error) {
        setError("This login link is invalid or has expired.");
      } else {
        router.push("/dashboard");
      }
    });
  }, [params, router]);

  return (
    <div className="text-center space-y-3">
      {error ? (
        <>
          <p className="text-th-danger text-sm">{error}</p>
          <Link href="/login" className="text-th-accent hover:text-th-accent text-sm">
            Go to login →
          </Link>
        </>
      ) : (
        <p className="text-th-muted text-sm">Logging you in...</p>
      )}
    </div>
  );
}

export default function MagicLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-th-canvas px-4">
      <Suspense fallback={<p className="text-th-muted text-sm">Logging you in...</p>}>
        <MagicLoginInner />
      </Suspense>
    </div>
  );
}
