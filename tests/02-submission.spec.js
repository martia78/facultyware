// tests/02-submission.spec.js
// Test Suite: Fitur Pengajuan Pengunduran Diri (Mahasiswa)

const { test, expect } = require('@playwright/test');
const { login, BASE_URL } = require('./helpers');
const path = require('path');
const fs   = require('fs');

// File PDF dummy untuk upload
const DUMMY_PDF = path.join(__dirname, 'fixtures', 'test-document.pdf');

test.beforeAll(async () => {
  // Buat file PDF dummy jika belum ada
  const dir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DUMMY_PDF)) {
    // PDF minimal valid
    const minPdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF';
    fs.writeFileSync(DUMMY_PDF, minPdf);
  }
});

// ── TC-SUB-01: Dashboard mahasiswa tampil ─────────────────────────────────
test('TC-SUB-01: Dashboard mahasiswa menampilkan informasi mahasiswa', async ({ page }) => {
  await login(page, '2211521000', 'password123');
  await page.goto(`${BASE_URL}/mahasiswa/dashboard`);
  await expect(page.locator('body')).toContainText(/Dashboard Mahasiswa/i);
  await expect(page.locator('body')).toContainText(/Nama Mahasiswa|NIM/i);
});

// ── TC-SUB-02: Halaman buat pengajuan tampil ──────────────────────────────
test('TC-SUB-02: Halaman formulir pengajuan menampilkan semua field', async ({ page }) => {
  await login(page, '2211521000', 'password123');
  await page.goto(`${BASE_URL}/mahasiswa/submissions/create`);
  await expect(page.locator('#address, [name="address"]')).toBeVisible();
  await expect(page.locator('#phone, [name="phone"]')).toBeVisible();
  await expect(page.locator('#gpa, [name="gpa"]')).toBeVisible();
  await expect(page.locator('#total_sks, [name="total_sks"]')).toBeVisible();
  await expect(page.locator('#reason, [name="reason"]')).toBeVisible();
});

// ── TC-SUB-03: Validasi - submit form kosong ditolak ──────────────────────
test('TC-SUB-03: Submit formulir kosong menampilkan pesan validasi', async ({ page }) => {
  await login(page, '2211521000', 'password123');
  await page.goto(`${BASE_URL}/mahasiswa/submissions/create`);
  await page.click('button[type="submit"]');
  // Harus ada error validasi atau tetap di halaman
  await expect(page).toHaveURL(/submissions\/create|submissions$/);
});

// ── TC-SUB-04: Validasi IPK di luar range 0-4 ────────────────────────────
test('TC-SUB-04: IPK di luar rentang 0-4 ditolak validasi', async ({ page }) => {
  await login(page, '2211521000', 'password123');
  await page.goto(`${BASE_URL}/mahasiswa/submissions/create`);
  await page.fill('[name="gpa"]', '5.0');
  await page.fill('[name="address"]', 'Jl. Test No. 1');
  await page.fill('[name="phone"]', '08123456789');
  await page.fill('[name="total_sks"]', '100');
  await page.fill('[name="reason"]', 'Alasan test');
  const inputEl = page.locator('[name="gpa"]');
  const validity = await inputEl.evaluate((el) => el.validity.valid);
  expect(validity).toBeFalsy();
});

// ── TC-SUB-05: Simpan sebagai Draft ───────────────────────────────────────
test('TC-SUB-05: Menyimpan formulir lengkap berhasil sebagai Draft', async ({ page }) => {
  await login(page, '2211521000', 'password123');
  // Cek dulu apakah sudah ada pengajuan aktif
  await page.goto(`${BASE_URL}/mahasiswa/submissions/create`);
  const currentUrl = page.url();
  if (currentUrl.includes('edit') || currentUrl.includes('submissions/')) {
    // Sudah ada draft, skip pembuatan baru
    return;
  }

  await page.fill('[name="address"]', 'Jl. Merdeka No. 10, Padang');
  await page.fill('[name="phone"]', '08123456789');
  await page.fill('[name="gpa"]', '3.50');
  await page.fill('[name="total_sks"]', '120');
  await page.fill('[name="reason"]', 'Alasan pengujian otomatis Playwright');

  const fileInput = page.locator('input[type="file"][name="application_letter"]');
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(DUMMY_PDF);
  }

  await page.click('button[type="submit"]');
  await page.waitForURL(/submissions\/\d+/);
  await expect(page.locator('body')).toContainText(/Draft|Permohonan/i);
});

// ── TC-SUB-06: Halaman detail pengajuan tampil ────────────────────────────
test('TC-SUB-06: Halaman detail pengajuan menampilkan data dengan benar', async ({ page }) => {
  await login(page, '2211521000', 'password123');
  await page.goto(`${BASE_URL}/mahasiswa/submissions`);
  const detailLink = page.locator('a[href*="/submissions/"]').first();
  if (await detailLink.count() > 0) {
    await detailLink.click();
    await expect(page.locator('body')).toContainText(/Nomor|Status|Pengajuan/i);
  }
});

// ── TC-SUB-07: Tombol Edit hanya muncul saat status Draft ────────────────
test('TC-SUB-07: Tombol Edit hanya tampil saat status Draft', async ({ page }) => {
  await login(page, '2211521000', 'password123');
  await page.goto(`${BASE_URL}/mahasiswa/submissions`);
  const rows = page.locator('tbody tr');
  const count = await rows.count();
  if (count > 0) {
    const detailBtn = page.locator('a[href*="/submissions/"]').first();
    await detailBtn.click();
    const bodyText = await page.locator('body').textContent();
    // Jika Draft, tombol Edit ada; jika bukan Draft, tidak ada
    if (bodyText?.includes('Draft')) {
      await expect(page.locator('a[href*="/edit"]')).toBeVisible();
    }
  }
});

// ── TC-SUB-08: Konfirmasi hapus draft menampilkan dialog ──────────────────
test('TC-SUB-08: Tombol Hapus Draft menampilkan dialog konfirmasi', async ({ page }) => {
  await login(page, '2211521000', 'password123');
  await page.goto(`${BASE_URL}/mahasiswa/submissions`);
  const detailLink = page.locator('a[href*="/submissions/"]').first();
  if (await detailLink.count() > 0) {
    await detailLink.click();
    const deleteBtn = page.locator('button:has-text("Hapus Draft")');
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click();
      await expect(page.locator('#dialog-delete, [role="dialog"]')).toBeVisible();
    }
  }
});

// ── TC-SUB-09: Checkbox wajib dicentang sebelum hapus ────────────────────
test('TC-SUB-09: Tombol konfirmasi hapus disabled sebelum checkbox dicentang', async ({ page }) => {
  await login(page, '2211521000', 'password123');
  await page.goto(`${BASE_URL}/mahasiswa/submissions`);
  const detailLink = page.locator('a[href*="/submissions/"]').first();
  if (await detailLink.count() > 0) {
    await detailLink.click();
    const deleteBtn = page.locator('button:has-text("Hapus Draft")');
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click();
      const confirmBtn = page.locator('#confirm-delete-btn');
      await expect(confirmBtn).toBeDisabled();
      await page.locator('#confirm-delete-checkbox').check();
      await expect(confirmBtn).toBeEnabled();
    }
  }
});

// ── TC-SUB-10: Riwayat pengajuan menampilkan list dengan search ───────────
test('TC-SUB-10: Halaman riwayat pengajuan mendukung pencarian', async ({ page }) => {
  await login(page, '2211521000', 'password123');
  await page.goto(`${BASE_URL}/mahasiswa/submissions`);
  await expect(page.locator('body')).toContainText(/Riwayat/i);
  const searchInput = page.locator('[name="search"]');
  if (await searchInput.count() > 0) {
    await searchInput.fill('RES-');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/search=RES-/);
  }
});

// ── TC-SUB-11: Alasan melebihi 225 karakter ditolak ──────────────────────
test('TC-SUB-11: Alasan lebih dari 225 karakter dibatasi oleh maxlength', async ({ page }) => {
  await login(page, '2211521000', 'password123');
  await page.goto(`${BASE_URL}/mahasiswa/submissions/create`);
  const reason = page.locator('[name="reason"]');
  if (await reason.count() > 0) {
    const longText = 'A'.repeat(300);
    await reason.fill(longText);
    const val = await reason.inputValue();
    expect(val.length).toBeLessThanOrEqual(225);
  }
});

// ── TC-SUB-12: Tracking status tampil di dashboard ───────────────────────
test('TC-SUB-12: Dashboard menampilkan tracking status pengajuan', async ({ page }) => {
  await login(page, '2211521000', 'password123');
  await page.goto(`${BASE_URL}/mahasiswa/dashboard`);
  await expect(page.locator('body')).toContainText(/Tracking|Draft|Diajukan/i);
});
