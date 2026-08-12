import Link from "next/link";
import { Home } from "lucide-react";

export default function ListingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#080c14]/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Home className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">TenantHub</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
            <Link href="/signup" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-gray-600">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Home className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-white">TenantHub</span>
        </div>
        © {new Date().getFullYear()} TenantHub. All rights reserved.
      </footer>
    </div>
  );
}
