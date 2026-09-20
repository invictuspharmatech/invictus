import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import type { ApiPage } from "@/lib/api-types";

export default async function CmsPagesPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const pages = await djangoAuthed<ApiPage[]>("/api/admin/cms/pages/");

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">Pages</h1>
          <p className="mt-2 text-sm text-muted-foreground">HTML pages rendered on the storefront.</p>
        </div>
        <Link href="/admin/cms/pages/new" className="gold-btn">
          New page
        </Link>
      </div>
      <div className="mt-6 space-y-3">
        {pages.map((page) => (
          <Link key={page.id} href={`/admin/cms/pages/${page.id}`} className="tile block">
            <p>{page.title}</p>
            <p className="text-sm text-muted-foreground">
              /{page.slug} · {page.isPublished ? "published" : "draft"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
