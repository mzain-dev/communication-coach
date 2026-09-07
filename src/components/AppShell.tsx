"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; adminOnly?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/progress", label: "Progress" },
  { href: "/speaking", label: "Speaking Practice" },
  { href: "/writing", label: "Writing Practice" },
  { href: "/listening", label: "Listening Practice" },
  { href: "/client-track", label: "Client Track" },
  { href: "/youtube", label: "YouTube Learning" },
  { href: "/vocabulary", label: "Vocabulary Bank" },
  { href: "/grammar", label: "Grammar Tracker" },
  { href: "/settings", label: "Settings" },
  { href: "/admin/users", label: "User Management", adminOnly: true },
];

export function AppShell({
  user,
  children,
}: {
  user: { name: string; role: "admin" | "user" };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "admin");

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground active:bg-border"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <span className="text-base font-semibold">Communication Coach</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-card p-4 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs capitalize text-muted">{user.role}</p>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted active:bg-border"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ul className="flex flex-1 flex-col gap-1">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded-lg px-3 py-3 text-sm font-medium ${
                        active ? "bg-accent text-accent-foreground" : "text-foreground active:bg-border"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 rounded-lg border border-border px-3 py-3 text-left text-sm font-medium text-danger active:bg-border"
            >
              Log out
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1">{children}</main>
    </div>
  );
}
