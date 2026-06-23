// tests/08-sk-pdf.spec.js
// Test Suite: Unduh SK PDF & Format Nomor SK

const { test, expect } = require('@playwright/test');
const { login, apiLogin, BASE_URL } = require('./helpers');

// ── TC-SK-01: Tombol Unduh SK PDF muncul di dashboard mahasiswa yang disetujui
test('TC-SK-01: Tombol Unduh SK PDF muncul di dashboard mahasiswa yang disetujui final', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/mahasiswa/dashboard`);
  await expect(page.locator('a[href*="/pdf"]').first()).toBeVisible();
  await expect(page.locator('body')).toContainText(/Unduh SK/i);
});

// ── TC-SK-02: Nomor SK menggunakan format resmi universitas ──────────────
test('TC-SK-02: Nomor SK menggunakan format resmi UN16.15/KM/tahun', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/mahasiswa/dashboard`);
  const bodyText = await page.locator('body').textContent();
  // Format: NNN/UN16.15/KM/YYYY
  expect(bodyText).toMatch(/\d{3}\/UN16\.15\/KM\/\d{4}/);
});

// ── TC-SK-03: Endpoint PDF mengembalikan file PDF valid ───────────────────
test('TC-SK-03: Endpoint PDF mengembalikan response dengan content-type PDF', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  // Ambil ID submission dari dashboard
  await page.goto(`${BASE_URL}/mahasiswa/dashboard`);
  const pdfLink = page.locator('a[href*="/pdf"]').first();
  const href = await pdfLink.getAttribute('href');
  expect(href).toMatch(/\/pdf$/);

  // Cek response header via fetch
  const response = await page.evaluate(async (url) => {
    const res = await fetch(url);
    return {
      status: res.status,
      contentType: res.headers.get('content-type'),
    };
  }, `${BASE_URL}${href}`);

  expect(response.status).toBe(200);
  expect(response.contentType).toContain('application/pdf');
});

// ── TC-SK-04: Mahasiswa yang belum disetujui tidak bisa akses endpoint PDF ─
test('TC-SK-04: Mahasiswa dengan pengajuan pending tidak bisa akses PDF', async ({ page }) => {
  await login(page, '2211521001', 'Mhs@2211521001');
  await page.goto(`${BASE_URL}/mahasiswa/dashboard`);
  // Tidak ada tombol Unduh SK untuk pengajuan yang belum disetujui
  const pdfLink = page.locator('a[href*="/pdf"]');
  expect(await pdfLink.count()).toBe(0);
});

// ── TC-SK-05: Akses endpoint PDF milik mahasiswa lain ditolak ─────────────
test('TC-SK-05: Mahasiswa tidak dapat mengakses PDF milik mahasiswa lain', async ({ page }) => {
  await login(page, '2211521001', 'Mhs@2211521001');
  // Coba akses PDF submission milik Budi Santoso (id=1)
  const response = await page.goto(`${BASE_URL}/mahasiswa/submissions/1/pdf`);
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).toMatch(/tidak ditemukan|403|tidak memiliki izin/i);
});

// ── TC-SK-06: Dashboard mahasiswa disetujui tidak menampilkan tombol buat pengajuan baru
test('TC-SK-06: Dashboard mahasiswa disetujui tidak menampilkan tombol Buat Pengajuan', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/mahasiswa/dashboard`);
  const buatBtn = page.locator('a[href="/mahasiswa/submissions/create"]:has-text("Buat Pengajuan")');
  expect(await buatBtn.count()).toBe(0);
});

// ── TC-SK-07: Mahasiswa disetujui tidak bisa akses halaman create via URL langsung
test('TC-SK-07: Mahasiswa disetujui tidak bisa buat pengajuan baru via URL langsung', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/mahasiswa/submissions/create`);
  // Harus redirect ke dashboard dengan pesan error
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator('body')).toContainText(/disetujui|tidak dapat/i);
});

// ── TC-SK-08: Nomor SK baru dibuat otomatis dengan urutan yang benar ───────
test('TC-SK-08: Nomor SK format urutan per tahun tampil di halaman detail', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/mahasiswa/submissions`);
  const detailLink = page.locator('a[href*="/mahasiswa/submissions/"]').first();
  if (await detailLink.count() > 0) {
    await detailLink.click();
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/\d{3}\/UN16\.15\/KM\/\d{4}/);
  }
});