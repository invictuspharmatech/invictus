"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Role } from "@/lib/enums";
import { asRole, roleLabel } from "@/lib/roles";
import type { ApiAdminUser } from "@/lib/api-types";

function roleOptions(viewerRole: string): Role[] {
  const options: Role[] = [
    Role.CUSTOMER,
    Role.WAREHOUSE_1,
    Role.WAREHOUSE_2,
    Role.ADMIN,
  ];
  const resolved = asRole(viewerRole);
  switch (resolved) {
    case Role.SUPERUSER:
      options.push(Role.SUPERUSER);
      break;
    case Role.ADMIN:
    case Role.WAREHOUSE_1:
    case Role.WAREHOUSE_2:
    case Role.CUSTOMER:
      break;
    default: {
      const exhaustive: never = resolved;
      return exhaustive;
    }
  }
  return options;
}

export function UserForm({
  user,
  viewerRole,
}: {
  user?: ApiAdminUser;
  viewerRole: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  return (
    <form
      className="mt-6 grid max-w-xl gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const form = new FormData(event.currentTarget);
        const payload = {
          name: String(form.get("name") || ""),
          email: String(form.get("email") || ""),
          role: String(form.get("role") || Role.CUSTOMER),
          password: String(form.get("password") || ""),
          isActive: form.get("isActive") === "on",
          isAffiliate: form.get("isAffiliate") === "on",
        };
        const res = await fetch(user ? `/api/admin/users/${user.id}` : "/api/admin/users", {
          method: user ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            data && typeof data === "object" && "error" in data
              ? String(data.error)
              : "Could not save user.",
          );
          return;
        }
        router.push("/admin/users");
        router.refresh();
      }}
    >
      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      <label className="grid gap-1 text-sm">
        Name
        <input className="field" name="name" defaultValue={user?.name} required />
      </label>
      <label className="grid gap-1 text-sm">
        Email
        <input className="field" name="email" type="email" defaultValue={user?.email} required />
      </label>
      <label className="grid gap-1 text-sm">
        Type
        <select className="field" name="role" defaultValue={user?.role ?? Role.CUSTOMER}>
          {roleOptions(viewerRole).map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        {user ? "New password (optional)" : "Password"}
        <input
          className="field"
          name="password"
          type="password"
          minLength={user ? undefined : 8}
          required={!user}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="isActive" type="checkbox" defaultChecked={user?.isActive ?? true} />
        Active
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="isAffiliate" type="checkbox" defaultChecked={user?.isAffiliate} />
        Affiliate
      </label>
      <button className="gold-btn w-fit" type="submit">
        {user ? "Save user" : "Create user"}
      </button>
    </form>
  );
}
