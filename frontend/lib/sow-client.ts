export async function saveCanonicalSOW(sowId: string, data: any) {
  const res = await fetch('/api/sow/canonical', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sowId, data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to save canonical SOW: ${res.status}`);
  }
  return res.json();
}
