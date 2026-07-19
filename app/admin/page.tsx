import { redirect } from "next/navigation";

/** Canonical admin UI is /admin-ui — keep /admin as a stable alias. */
export default function AdminPage() {
  redirect("/admin-ui");
}
