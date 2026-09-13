"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  is_active: number;
  created_at: string;
  last_login_at: string | null;
  has_api_key: number;
};

function formatLastActive(lastLoginAt: string | null): string {
  if (!lastLoginAt) return "Never logged in";
  const days = Math.floor((Date.now() - new Date(lastLoginAt).getTime()) / 86_400_000);
  if (days <= 0) return "Active today";
  if (days === 1) return "Active yesterday";
  return `Last active ${days} days ago`;
}

export default function ManageUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetInfo, setResetInfo] = useState<{ userId: number; temporaryPassword: string } | null>(null);

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/manage/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/manage/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/manage/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, temporaryPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create user.");
        return;
      }
      setName("");
      setEmail("");
      setTemporaryPassword("");
      setShowForm(false);
      loadUsers();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user: UserRow) {
    await fetch(`/api/manage/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.is_active }),
    });
    loadUsers();
  }

  async function resetPassword(user: UserRow) {
    setResetInfo(null);
    const res = await fetch(`/api/manage/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: true }),
    });
    const data = await res.json();
    if (res.ok) setResetInfo({ userId: user.id, temporaryPassword: data.temporaryPassword });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">User Management</h1>
          <p className="text-sm text-muted">Create accounts and monitor status.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
        >
          {showForm ? "Cancel" : "+ New user"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Temporary password
            <input
              required
              minLength={8}
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create user"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/manage/users/${u.id}`} className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                  <p className="text-xs text-muted">{formatLastActive(u.last_login_at)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge>{u.role}</Badge>
                    <Badge tone={u.has_api_key ? "accent" : "muted"}>
                      {u.has_api_key ? "API key set" : "No API key"}
                    </Badge>
                    {!u.is_active && <Badge tone="danger">Deactivated</Badge>}
                  </div>
                </Link>
                <div className="flex shrink-0 flex-col gap-1.5">
                  {u.role !== "admin" && (
                    <button
                      onClick={() => toggleActive(u)}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium active:bg-border"
                    >
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                  <button
                    onClick={() => resetPassword(u)}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium active:bg-border"
                  >
                    Reset password
                  </button>
                </div>
              </div>
              {resetInfo?.userId === u.id && (
                <div className="mt-2 rounded-lg bg-accent/10 p-2 text-xs">
                  New temporary password: <span className="font-mono font-semibold">{resetInfo.temporaryPassword}</span>
                  <br />
                  Share this with {u.name} — it won&apos;t be shown again.
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" | "danger" }) {
  const toneClass =
    tone === "accent" ? "bg-accent/10 text-accent" : tone === "danger" ? "bg-danger/10 text-danger" : "bg-border text-muted";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${toneClass}`}>{children}</span>;
}
