export interface Asset { id: string; kind: string; title: string; body: string; status: string; beneficiaryRefs: string[]; facts: string[]; revision: number }
export function downloadText(title: string, body: string) {
  const url = URL.createObjectURL(new Blob([`${title}\n\n${body}\n`], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `${title.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 70) || "sector-content"}.txt`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
