"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Me {
  userId: string;
  email: string;
  name: string;
  role: "owner" | "staff" | "viewer";
  organizationId: string;
  organizationName: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          router.push("/login");
          return null;
        }
        return res.json() as Promise<Me>;
      })
      .then((data) => {
        if (data) setMe(data);
        setLoading(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  async function handleLogout() {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
    router.push("/login");
  }

  if (loading) {
    return (
      <main style={{ fontFamily: "system-ui", padding: "3rem 1.5rem" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (!me) return null; // already redirecting

  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem 1.5rem", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{me.organizationName}</h1>
        <button
          onClick={handleLogout}
          style={{ padding: "0.5rem 1rem", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
        >
          Log out
        </button>
      </div>
      <p style={{ color: "#666" }}>
        Logged in as {me.name} ({me.email}) · role: {me.role}
      </p>
      <div style={{ marginTop: "2rem", padding: "1.25rem", background: "#f5f5f5", borderRadius: 8 }}>
        <p style={{ margin: 0 }}>
          Audit, remediation, and Ad Grants tooling land here in later slices.
          Go to <a href="/audits">Audits &amp; fixes</a>, <a href="/ad-grants">Ad Grants</a> or <a href="/content">Content &amp; consent</a>.
        </p>
      </div>
    </main>
  );
}
