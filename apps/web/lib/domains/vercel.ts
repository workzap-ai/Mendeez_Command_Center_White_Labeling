// NOT LIVE — scaffold only. No Vercel project/API token was available this session, so this is
// written from Vercel's documented Domains API but never actually called against a real project.
// Treat every export here as a draft to verify, not a working integration.
//
// The real flow once a Vercel project exists: this app's Vercel project needs a wildcard domain
// (*.yourplatform.app) added once (via the dashboard or `POST /v10/projects/{id}/domains` with
// the apex), which covers every tenant subdomain automatically — nothing per-tenant needed there.
// A tenant's OWN custom domain (the thing tenant_domains actually tracks) is different: it has to
// be added to the Vercel project individually (`POST /v10/projects/{id}/domains` with that exact
// domain), and Vercel then reports whether its DNS/SSL verification has completed — that result is
// what should populate tenant_domains.verified_at, not an assumption that adding it succeeded.
//
// addDomainAction (app/admin/(dashboard)/actions.ts) currently only writes the tenant_domains row
// — it does NOT call Vercel, so a domain added through the admin UI today will never actually
// route traffic until this is wired up and that action calls addDomainToVercelProject() below,
// then updates verified_at from the response (or a follow-up poll/webhook, since verification is
// asynchronous on Vercel's side).
import 'server-only';

const VERCEL_API = 'https://api.vercel.com';

function vercelHeaders() {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) throw new Error('VERCEL_API_TOKEN is not set');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function addDomainToVercelProject(domain: string) {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) throw new Error('VERCEL_PROJECT_ID is not set');

  const resp = await fetch(`${VERCEL_API}/v10/projects/${projectId}/domains`, {
    method: 'POST',
    headers: vercelHeaders(),
    body: JSON.stringify({ name: domain }),
  });
  if (!resp.ok) throw new Error(`Vercel domain add failed (${resp.status}): ${await resp.text()}`);
  return resp.json(); // includes verification status / required DNS records
}

export async function removeDomainFromVercelProject(domain: string) {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) throw new Error('VERCEL_PROJECT_ID is not set');

  const resp = await fetch(`${VERCEL_API}/v10/projects/${projectId}/domains/${domain}`, {
    method: 'DELETE',
    headers: vercelHeaders(),
  });
  if (!resp.ok && resp.status !== 404) throw new Error(`Vercel domain remove failed (${resp.status}): ${await resp.text()}`);
}
