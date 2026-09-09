#!/usr/bin/env node
/**
 * Two-account privacy + trusted-validation proof.
 *
 * Signs in as two real users and drives the *public* Neon Data API exactly the way the
 * browser does -- same URL, same bearer JWT, no server-side helper in the middle. Then it
 * tries, on purpose, to do everything a malicious client would try:
 *
 *   - read another user's rows
 *   - update another user's row
 *   - delete another user's row
 *   - insert a row owned by another user
 *   - rewrite one of its own rows to belong to another user
 *   - write a priority outside ('high','medium','low')
 *   - write a blank name
 *
 * Every one of these must fail, and must fail in Postgres rather than in the UI. The app's
 * client-side Zod validation is deliberately bypassed here: that is the whole point.
 *
 * Run: npm run verify:rls
 */
import './load-env.mjs';

const AUTH = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const DATA = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;
const ORIGIN = process.env.VERIFY_ORIGIN ?? 'http://localhost:3000';

for (const [k, v] of Object.entries({ NEXT_PUBLIC_NEON_AUTH_URL: AUTH, NEXT_PUBLIC_NEON_DATA_API_URL: DATA })) {
  if (!v) { console.error(`${k} is not set. Copy .env.example to .env.local first.`); process.exit(1); }
}

const results = [];
const record = (name, pass, detail) => { results.push({ name, pass, detail }); };

/** Sign in (creating the account on first run) and exchange the session for a Data API JWT. */
async function signIn(email, password, name) {
  const post = (path, body) =>
    fetch(`${AUTH}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify(body),
    });

  let res = await post('/sign-in/email', { email, password });
  if (!res.ok) {
    res = await post('/sign-up/email', { email, password, name });
    if (!res.ok) throw new Error(`could not sign in or sign up ${email}: ${res.status} ${await res.text()}`);
  }

  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const tokenRes = await fetch(`${AUTH}/token`, { headers: { Cookie: cookie, Origin: ORIGIN } });
  if (!tokenRes.ok) throw new Error(`token exchange failed for ${email}: ${tokenRes.status}`);

  const { token } = await tokenRes.json();
  const sub = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
  return { token, userId: sub, email };
}

/** Raw Data API call -- the same HTTP surface the browser uses. */
async function api(user, path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${DATA}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${user.token}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, ok: res.ok, body: json };
}

const A = await signIn(
  process.env.TEST_USER_A_EMAIL ?? 'grader-a@berkeley-tracker.test',
  process.env.TEST_USER_A_PASSWORD ?? 'GraderTestA!2026', 'Grader A');
const B = await signIn(
  process.env.TEST_USER_B_EMAIL ?? 'grader-b@berkeley-tracker.test',
  process.env.TEST_USER_B_PASSWORD ?? 'GraderTestB!2026', 'Grader B');

console.log(`User A  ${A.email}  id=${A.userId}`);
console.log(`User B  ${B.email}  id=${B.userId}\n`);

// --- setup: each user creates one contact -----------------------------------------------
const mk = (who, name) => api(who, '/contacts', {
  method: 'POST',
  prefer: 'return=representation',
  // Note: user_id is deliberately NOT sent. It defaults to auth.user_id() in the database.
  body: { name, company: 'Acme', role: 'Engineer', met_at: 'Career fair', priority: 'high' },
});

const aRow = (await mk(A, 'A private contact')).body?.[0];
const bRow = (await mk(B, 'B private contact')).body?.[0];
if (!aRow || !bRow) { console.error('setup failed -- could not create seed contacts'); process.exit(1); }

record('user_id defaults to the JWT identity, not client input',
  aRow.user_id === A.userId, `row.user_id=${aRow.user_id}`);

// --- 1. A cannot READ B's rows ----------------------------------------------------------
const aList = await api(A, '/contacts?select=id,user_id');
const leaked = (aList.body ?? []).filter((r) => r.user_id !== A.userId);
record("A's contact list contains none of B's rows",
  leaked.length === 0, `${aList.body?.length ?? 0} rows returned, ${leaked.length} foreign`);

const aReadsB = await api(A, `/contacts?id=eq.${bRow.id}&select=*`);
record("A cannot read B's row even by exact id",
  Array.isArray(aReadsB.body) && aReadsB.body.length === 0, `returned ${aReadsB.body?.length ?? 0} rows`);

// --- 2. A cannot UPDATE B's row ---------------------------------------------------------
const aUpdatesB = await api(A, `/contacts?id=eq.${bRow.id}`, {
  method: 'PATCH', prefer: 'return=representation', body: { name: 'HACKED BY A' },
});
record("A cannot update B's row (0 rows affected)",
  Array.isArray(aUpdatesB.body) && aUpdatesB.body.length === 0, `affected ${aUpdatesB.body?.length ?? 0} rows`);

// --- 3. A cannot DELETE B's row ---------------------------------------------------------
const aDeletesB = await api(A, `/contacts?id=eq.${bRow.id}`, {
  method: 'DELETE', prefer: 'return=representation',
});
record("A cannot delete B's row (0 rows affected)",
  Array.isArray(aDeletesB.body) && aDeletesB.body.length === 0, `affected ${aDeletesB.body?.length ?? 0} rows`);

// --- 4. A cannot INSERT a row owned by B ------------------------------------------------
const aInsertsAsB = await api(A, '/contacts', {
  method: 'POST', prefer: 'return=representation',
  body: { name: 'Planted by A', user_id: B.userId, priority: 'low' },
});
record("A cannot insert a row owned by B (insert WITH CHECK)",
  !aInsertsAsB.ok, `HTTP ${aInsertsAsB.status} ${aInsertsAsB.body?.code ?? ''}`);

// --- 5. A cannot hand its own row to B --------------------------------------------------
const aReassigns = await api(A, `/contacts?id=eq.${aRow.id}`, {
  method: 'PATCH', prefer: 'return=representation', body: { user_id: B.userId },
});
record("A cannot change its row's owner to B (update WITH CHECK + column grant)",
  !aReassigns.ok || (Array.isArray(aReassigns.body) && aReassigns.body.length === 0),
  `HTTP ${aReassigns.status} ${aReassigns.body?.code ?? ''}`);

// --- 6. Trusted validation: bad priority ------------------------------------------------
const badPriority = await api(A, '/contacts', {
  method: 'POST', prefer: 'return=representation', body: { name: 'Bad priority', priority: 'urgent' },
});
record("priority 'urgent' rejected by the database, not the UI",
  !badPriority.ok && String(badPriority.body?.message ?? '').includes('contacts_priority_valid'),
  `HTTP ${badPriority.status} ${badPriority.body?.message ?? ''}`);

// --- 7. Trusted validation: blank name --------------------------------------------------
const blankName = await api(A, '/contacts', {
  method: 'POST', prefer: 'return=representation', body: { name: '   ', priority: 'low' },
});
record('blank name rejected by the database, not the UI',
  !blankName.ok && String(blankName.body?.message ?? '').includes('contacts_name_not_blank'),
  `HTTP ${blankName.status} ${blankName.body?.message ?? ''}`);

// --- 8. B's row survived everything A tried ---------------------------------------------
const bCheck = await api(B, `/contacts?id=eq.${bRow.id}&select=name`);
record("B's row is untouched after all of A's attempts",
  bCheck.body?.[0]?.name === 'B private contact', `name=${bCheck.body?.[0]?.name}`);

// --- cleanup ----------------------------------------------------------------------------
await api(A, `/contacts?id=eq.${aRow.id}`, { method: 'DELETE' });
await api(B, `/contacts?id=eq.${bRow.id}`, { method: 'DELETE' });

// --- report -----------------------------------------------------------------------------
const width = Math.max(...results.map((r) => r.name.length));
console.log('RLS / trusted-validation checks');
console.log('-'.repeat(width + 10));
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.detail}`);
}
console.log('-'.repeat(width + 10));

const failed = results.filter((r) => !r.pass);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
