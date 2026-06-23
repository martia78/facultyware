// tests/04-wd1.spec.js
// Test Suite: Fitur Wakil Dekan I

const { test, expect } = require('@playwright/test');
const { login, BASE_URL } = require('./helpers');

// ── TC-WD1-01: Dashboard WD1 tampil ──────────────────────────────────────
test('TC-WD1-01: Dashboard WD1 menampilkan daftar pengajuan yang menunggu', async ({ page }) => {
  await login(page, 'wd1.fti', 'WD1@Unand2026');
  await page.goto(`${BASE_URL}/wd1`);
  await expect(page.locator('body')).toContainText(/WD1|Wakil Dekan|Inbox|Dashboard/i);
});

// ── TC-WD1-02: Tabel pengajuan tampil ────────────────────────────────────
test('TC-WD1-02: Halaman WD1 menampilkan tabel pengajuan', async ({ page }) => {
  await login(page, 'wd1.fti', 'WD1@Unand2026');
  await page.goto(`${BASE_URL}/wd1`);
  await expect(page.locator('table')).toBeVisible();
});

// ── TC-WD1-03: ACL WD1 tidak bisa akses halaman mahasiswa ────────────────
test('TC-WD1-03: WD1 tidak dapat mengakses halaman mahasiswa', async ({ page }) => {
  await login(page, 'wd1.fti', 'WD1@Unand2026');
  await page.goto(`${BASE_URL}/mahasiswa/dashboard`);
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).toMatch(/403|ditolak|tidak memiliki izin/i);
});

// ── TC-WD1-04: ACL WD1 tidak bisa akses halaman kaprodi ──────────────────
test('TC-WD1-04: WD1 tidak dapat mengakses halaman kaprodi', async ({ page }) => {
  await login(page, 'wd1.fti', 'WD1@Unand2026');
  await page.goto(`${BASE_URL}/kaprodi/dashboard`);
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).toMatch(/403|ditolak|tidak memiliki izin/i);
});

// ── TC-WD1-05: Statistik menunggu/disetujui/ditolak tampil ───────────────
test('TC-WD1-05: Dashboard WD1 menampilkan statistik pengajuan', async ({ page }) => {
  await login(page, 'wd1.fti', 'WD1@Unand2026');
  await page.goto(`${BASE_URL}/wd1`);
  await expect(page.locator('body')).toContainText(/Menunggu|Disetujui|Ditolak/i);
});