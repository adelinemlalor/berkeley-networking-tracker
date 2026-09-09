#!/usr/bin/env node
/**
 * Captures the README's evidence screenshots by driving a real browser through the app.
 *
 * Scripted rather than hand-taken so the evidence can be regenerated against any deployment
 * -- local or production -- and so it cannot drift from what the app actually does.
 *
 *   npm run capture                                   # against http://localhost:3000
 *   BASE_URL=https://your-app.vercel.app npm run capture
 *
 * Uses the Chrome already installed on the machine (playwright-core downloads nothing).
 * Requires the two test accounts in .env.local.
 */
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import './load-env.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');

const A = { email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD };
const B = { email: process.env.TEST_USER_B_EMAIL, password: process.env.TEST_USER_B_PASSWORD };
if (!A.email || !B.email) {
  console.error('TEST_USER_A_* and TEST_USER_B_* must be set in .env.local');
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });

const shots = [];
async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  shots.push(name);
  console.log(`  captured ${name}.png`);
}

/** Fills the auth form and waits for the tracker to appear. */
async function signIn(page, user) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Your contacts' }).waitFor({ timeout: 20_000 });
}

// --------------------------------------------------------------------------------------
// Desktop walkthrough, as User A
// --------------------------------------------------------------------------------------
const desktop = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await desktop.newPage();

console.log('Desktop walkthrough (User A)');
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'Berkeley Networking Tracker' }).waitFor();
await shot(page, '01-sign-in');

await signIn(page, A);
await page.waitForTimeout(1200);

// Re-runnable: clear any demo contact a previous run left behind before adding it again.
for (let guard = 0; guard < 10; guard++) {
  const leftover = page.getByRole('button', { name: 'Delete Jordan Alvarez' });
  if ((await leftover.count()) === 0) break;
  await leftover.first().click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByText('Contact deleted').waitFor();
  await page.waitForTimeout(800);
}

await shot(page, '02-contacts-list');

// Invalid input fails safely: a blank name is refused with an inline message.
await page.getByRole('button', { name: /Add contact/ }).first().click();
await page.getByLabel('Name').fill('   ');
await page.getByRole('button', { name: 'Add contact', exact: true }).last().click();
await page.getByText('Name is required.').waitFor();
await shot(page, '03-validation-error');

// Create -- and catch the success toast.
await page.getByLabel('Name').fill('Jordan Alvarez');
await page.getByLabel('Company').fill('Notion');
await page.getByLabel('Role').fill('Product Manager');
await page.getByLabel('Where you met').fill('Berkeley Product Club, Mar 2026');
await page.getByRole('button', { name: 'Add contact', exact: true }).last().click();
await page.getByText('Contact added').waitFor();
await shot(page, '04-create-success');

// Edit.
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Edit Jordan Alvarez' }).click();
await page.getByLabel('Role').fill('Senior Product Manager');
await page.getByRole('button', { name: 'Save changes' }).click();
await page.getByText('Changes saved').waitFor();
await shot(page, '05-edit-success');

// Persistence: reload and show the edit survived, because it lives in Postgres.
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('cell', { name: 'Senior Product Manager' }).waitFor({ timeout: 20_000 });
await shot(page, '06-persists-after-refresh');

// Sort and filter.
await page.getByLabel('Sort contacts').click();
await page.getByRole('option', { name: 'Priority (high first)' }).click();
await page.waitForTimeout(400);
await shot(page, '07-sorted-by-priority');

await page.getByLabel('Filter by priority').click();
await page.getByRole('option', { name: 'high', exact: true }).click();
await page.waitForTimeout(400);
await shot(page, '08-filtered-high-priority');

await page.getByRole('button', { name: 'Clear filters' }).click();
await page.waitForTimeout(400);

// Delete.
await page.getByRole('button', { name: 'Delete Jordan Alvarez' }).click();
await page.getByRole('heading', { name: 'Delete this contact?' }).waitFor();
await shot(page, '09-delete-confirm');
await page.getByRole('button', { name: 'Delete', exact: true }).click();
await page.getByText('Contact deleted').waitFor();
await shot(page, '10-delete-success');

// Sign out returns to the signed-out screen.
await page.getByRole('button', { name: 'Sign out' }).click();
await page.getByRole('button', { name: 'Sign in' }).waitFor({ timeout: 30_000 });
await shot(page, '11-signed-out');

// --------------------------------------------------------------------------------------
// Two-account privacy: B signs in and sees only B's contacts
// --------------------------------------------------------------------------------------
console.log('Two-account privacy check (User B)');
const contextB = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const pageB = await contextB.newPage();
await signIn(pageB, B);
await pageB.waitForTimeout(1200);
await shot(pageB, '12-user-b-sees-only-own');

// --------------------------------------------------------------------------------------
// Mobile
// --------------------------------------------------------------------------------------
console.log('Mobile walkthrough (User A)');
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const pageM = await mobile.newPage();
await pageM.goto(BASE, { waitUntil: 'networkidle' });
await pageM.getByRole('heading', { name: 'Berkeley Networking Tracker' }).waitFor();
await shot(pageM, '13-mobile-sign-in');
await signIn(pageM, A);
await pageM.waitForTimeout(1200);
await shot(pageM, '14-mobile-contacts');

await browser.close();
console.log(`\n${shots.length} screenshots written to docs/screenshots/`);
