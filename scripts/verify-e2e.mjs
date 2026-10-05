#!/usr/bin/env node
// Formalizes the manual verification this repo's README describes doing by hand (sign in as a
// real user, reconstruct the @supabase/ssr session cookie, hit pages with curl) into a repeatable
// script — run this after any change to proxy.ts, a module's guard/RLS, or the auth hook, instead
// of re-deriving the cookie-reconstruction trick from scratch each time.
//
// PREREQUISITES (not created by this script):
//   - supabase/seed.sql applied (acme has finance+policy enabled, zenith has neither)
//   - Three test accounts existing in Supabase Auth, each wired to the right tenant:
//       acme-owner@test.dev / TestPass123!      -> tenant_memberships row for acme
//       zenith-owner@test.dev / TestPass123!    -> tenant_memberships row for zenith
//       platform-admin@test.dev / TestPass123!  -> public.users.is_platform_admin = true
//     See apps/web/README.md "Local development" for how to create these by hand; there is no
//     one-shot script for this on purpose — creating a user is an Admin API call, not SQL, so it
//     doesn't belong in seed.sql.
//   - The dev server running at BASE_URL (default http://localhost:3000) with PLATFORM_ROOT_DOMAIN
//     matching what acme.<root>/zenith.<root> below resolve against.
//   - apps/web/.env.local loaded (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) —
//     run as: node --env-file=apps/web/.env.local scripts/verify-e2e.mjs
import { createClient } from '@supabase/supabase-js';
import http from 'node:http';

const BASE_URL = process.env.VERIFY_BASE_URL || 'http://localhost:3000';
const ROOT = process.env.VERIFY_ROOT_DOMAIN || new URL(BASE_URL).hostname;
const PORT = new URL(BASE_URL).port;
const PASSWORD = 'TestPass123!';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set — run with --env-file.');
  process.exit(1);
}
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];

let passed = 0;
let failed = 0;
function check(label, ok) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (ok) passed++;
  else failed++;
}

async function cookieFor(email) {
  const supabase = createClient(supabaseUrl, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  const value = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url');
  return `sb-${projectRef}-auth-token=${value}`;
}

// Node's native fetch() (undici) refuses to let you set a custom Host header — it's on the
// Fetch spec's forbidden-header list, silently dropped rather than erroring, which is exactly
// how this script's first draft failed every single check against a server that manual curl
// testing had already proven correct. http.request() has no such restriction.
function get(host, path, cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT || 80,
        path,
        method: 'GET',
        headers: { Host: PORT ? `${host}:${PORT}` : host, Cookie: cookie ?? '' },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const acmeHost = `acme.${ROOT}`;
  const zenithHost = `zenith.${ROOT}`;

  const acmeCookie = await cookieFor('acme-owner@test.dev');
  const zenithCookie = await cookieFor('zenith-owner@test.dev');
  const adminCookie = await cookieFor('platform-admin@test.dev');

  // Tenant resolution + module gating, both directions.
  const acmeHome = await get(acmeHost, '/', acmeCookie);
  check('acme home shows Finance module', acmeHome.body.includes('P&amp;L, GST reporting'));
  check('acme home shows Policy module', acmeHome.body.includes('Policies &amp; SOPs') || acmeHome.body.includes('One place for every rule'));

  const acmePl = await get(acmeHost, '/finance/pl', acmeCookie);
  check('acme /finance/pl returns real data (200)', acmePl.status === 200 && acmePl.body.includes('net_sales'));

  const acmePolicy = await get(acmeHost, '/policy', acmeCookie);
  check('acme /policy returns real data (200)', acmePolicy.status === 200 && acmePolicy.body.includes('GST recording basis'));

  const zenithHome = await get(zenithHost, '/', zenithCookie);
  check('zenith home shows no modules', zenithHome.body.includes('No modules are enabled'));

  const zenithPl = await get(zenithHost, '/finance/pl', zenithCookie);
  check('zenith /finance/pl is blocked (404, not just hidden)', zenithPl.status === 404);

  const zenithPolicy = await get(zenithHost, '/policy', zenithCookie);
  check('zenith /policy is blocked (404, not just hidden)', zenithPolicy.status === 404);

  // Cross-tenant isolation via the real app, not simulated SQL.
  check("acme page never leaks zenith's data", !acmeHome.body.includes('Zenith Stores'));
  check("zenith page never leaks acme's data", !zenithHome.body.includes('Acme Retail'));

  // Unknown subdomain.
  const unknown = await get(`nope-${Date.now()}.${ROOT}`, '/', '');
  check('unregistered subdomain rewrites to tenant-not-found', unknown.body.includes('No workspace here'));

  // Admin panel: gating + cross-tenant listing.
  const adminUnauth = await get(ROOT, '/admin/tenants', '');
  check('unauthenticated /admin/tenants redirects away (not 200)', adminUnauth.status !== 200);

  const adminTenants = await get(ROOT, '/admin/tenants', adminCookie);
  check('platform admin sees both seeded tenants', adminTenants.body.includes('Acme Retail') && adminTenants.body.includes('Zenith Stores'));

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('VERIFY SCRIPT ERROR:', e.message);
  process.exit(1);
});
