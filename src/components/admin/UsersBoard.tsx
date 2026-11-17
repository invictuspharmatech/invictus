"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SignOutUserButton } from "@/components/admin/UserSessionActions";
import type { ApiAdminUser } from "@/lib/api-types";
import { Role } from "@/lib/enums";
import { isSuperuser, roleLabel } from "@/lib/roles";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: Role.CUSTOMER, label: roleLabel(Role.CUSTOMER) },
  { value: Role.ADMIN, label: roleLabel(Role.ADMIN) },
  { value: Role.WAREHOUSE_1, label: roleLabel(Role.WAREHOUSE_1) },
  { value: Role.WAREHOUSE_2, label: roleLabel(Role.WAREHOUSE_2) },
  { value: Role.SUPERUSER, label: roleLabel(Role.SUPERUSER) },
];

export function UsersBoard({ viewerRole }: { viewerRole: string }) {
  const [users, setUsers] = useState<ApiAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const roles = useMemo(
    () =>
      ROLE_OPTIONS.filter((row) => isSuperuser(viewerRole) || row.value !== Role.SUPERUSER),
    [viewerRole],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (appliedSearch) params.set("search", appliedSearch);
    if (roleFilter) params.set("role", roleFilter);
    if (activeFilter !== "") params.set("isActive", activeFilter);
    const query = params.toString();
    setLoading(true);
    setError("");
    void fetch(`/api/admin/users${query ? `?${query}` : ""}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | ApiAdminUser[]
          | { error?: string }
          | null;
        if (!response.ok) {
          setUsers([]);
          setError(
            data && !Array.isArray(data) && data.error ? data.error : "Could not load users.",
          );
          return;
        }
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setUsers([]);
        setError("Could not load users.");
      })
      .finally(() => setLoading(false));
  }, [appliedSearch, roleFilter, activeFilter]);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="field max-w-xs"
          type="search"
          placeholder="Search users…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setAppliedSearch(search.trim());
          }}
        />
        <select
          className="field max-w-[12rem]"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          {roles.map((row) => (
            <option key={row.value} value={row.value}>
              {row.label}
            </option>
          ))}
        </select>
        <select
          className="field max-w-[12rem]"
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All status</option>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </select>
        {(appliedSearch || roleFilter || activeFilter !== "") && (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setSearch("");
              setAppliedSearch("");
              setRoleFilter("");
              setActiveFilter("");
            }}
          >
            Clear
          </button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {loading ? "Loading…" : `${users.length} user${users.length === 1 ? "" : "s"}`}
      </p>
      {error ? <p className="text-sm text-brand-red">{error}</p> : null}

      <div className="tile overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Type</th>
              <th>Status</th>
              <th>Affiliate</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 ? (
              <tr>
                <td className="py-6 text-muted-foreground" colSpan={6}>
                  No users match these filters.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t border-border/40">
                  <td className="py-3">{user.name}</td>
                  <td>{user.email}</td>
                  <td>{roleLabel(user.role)}</td>
                  <td>{user.isActive ? "Active" : "Disabled"}</td>
                  <td>{user.isAffiliate ? user.affiliateCode : "—"}</td>
                  <td>
                    <span className="flex items-center gap-3">
                      {isSuperuser(viewerRole) ? (
                        <SignOutUserButton id={user.id} label={user.name || user.email} />
                      ) : null}
                      <Link href={`/admin/users/${user.id}`} className="text-sm text-signal">
                        Edit
                      </Link>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
