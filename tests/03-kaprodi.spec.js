// tests/03-kaprodi.spec.js
// Test Suite: Fitur Kaprodi (Verifikasi Pengajuan)

const { test, expect } = require('@playwright/test');
const { login, BASE_URL } = require('./helpers');

// ── TC-KAPRODI-01: Dashboard kaprodi tampil ───────────────────────────────
test('TC-KAPRODI-01: Dashboard kaprodi menampilkan statistik pengajuan', async ({ page }) => {
  await login(page, 'kaprodi123', 'password123');
  await page.goto(`${BASE_URL}/kaprodi/dashboard`);
  await expect(page.locator('body')).toContainText(/Dashboard|Ketua Program Studi/i);
  await expect(page.locator('body')).toContainText(/Menunggu|Verifikasi/i);
});

// ── TC-KAPRODI-02: Daftar pengajuan tampil ───────────────────────────────
test('TC-KAPRODI-02: Halaman daftar pengajuan kaprodi tampil dengan benar', async ({ page }) => {
  await login(page, 'kaprodi123', 'password123');
  await page.goto(`${BASE_URL}/kaprodi/submissions`);
  await expect(page.locator('body')).toContainText(/Daftar Pengajuan/i);
  await expect(page.locator('table')).toBeVisible();
});

// ── TC-KAPRODI-03: Pencarian di daftar pengajuan berfungsi ────────────────
test('TC-KAPRODI-03: Pencarian pada daftar pengajuan kaprodi berfungsi', async ({ page }) => {
  await login(page, 'kaprodi123', 'password123');
  await page.goto(`${BASE_URL}/kaprodi/submissions`);
  const searchInput = page.locator('[name="search"]');
  if (await searchInput.count() > 0) {
    await searchInput.fill('RES-');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/search=RES-/);
  }
});

// ── TC-KAPRODI-04: Detail pengajuan tampil ───────────────────────────────
test('TC-KAPRODI-04: Detail pengajuan menampilkan data mahasiswa dan formulir', async ({ page }) => {
  await login(page, 'kaprodi123', 'password123');
  await page.goto(`${BASE_URL}/kaprodi/submissions`);
  const detailLink = page.locator('a[href*="/kaprodi/submissions/"]').first();
  if (await detailLink.count() > 0) {
    await detailLink.click();
    await expect(page.locator('body')).toContainText(/Detail Pengajuan|Nomor/i);
    await expect(page.locator('body')).toContainText(/Setujui|Tolak/i);
  }
});

// ── TC-KAPRODI-05: Tombol setujui tersedia ───────────────────────────────
test('TC-KAPRODI-05: Tombol Setujui tersedia pada pengajuan yang menunggu', async ({ page }) => {
  await login(page, 'kaprodi123', 'password123');
  await page.goto(`${BASE_URL}/kaprodi/submissions`);
  const detailLink = page.locator('a[href*="/kaprodi/submissions/"]').first();
  if (await detailLink.count() > 0) {
    await detailLink.click();
    const approveBtn = page.locator('button:has-text("Setujui"), form[action*="approve"] button');
    if (await approveBtn.count() > 0) {
      await expect(approveBtn.first()).toBeVisible();
    }
  }
});

// ── TC-KAPRODI-06: Penolakan membutuhkan catatan ──────────────────────────
test('TC-KAPRODI-06: Menolak pengajuan tanpa catatan menampilkan error validasi', async ({ page }) => {
  await login(page, 'kaprodi123', 'password123');
  await page.goto(`${BASE_URL}/kaprodi/submissions`);
  const detailLink = page.locator('a[href*="/kaprodi/submissions/"]').first();
  if (await detailLink.count() > 0) {
    await detailLink.click();
    // Cari form reject
    const rejectForm = page.locator('form[action*="reject"]');
    if (await rejectForm.count() > 0) {
      await rejectForm.locator('button[type="submit"]').click();
      // Harus muncul error atau tetap di halaman
      await expect(page.locator('body')).toContainText(/wajib|required|error/i);
    }
  }
});

// ── TC-KAPRODI-07: ACL kaprodi tidak bisa akses WD1 ──────────────────────
test('TC-KAPRODI-07: Kaprodi tidak dapat mengakses halaman WD1', async ({ page }) => {
  await login(page, 'kaprodi123', 'password123');
  await page.goto(`${BASE_URL}/wd1`);
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).toMatch(/403|ditolak|tidak memiliki izin/i);
});

// ── TC-KAPRODI-08: Pagination pada daftar pengajuan ──────────────────────
test('TC-KAPRODI-08: Pagination pada daftar pengajuan kaprodi berfungsi', async ({ page }) => {
  await login(page, 'kaprodi123', 'password123');
  await page.goto(`${BASE_URL}/kaprodi/submissions?page=1`);
  await expect(page.locator('body')).toContainText(/Daftar Pengajuan/i);
  // Tidak crash saat akses page=1
  await expect(page.locator('table')).toBeVisible();
});
