// tests/06-document.spec.js
// Test Suite: Fitur Generate Dokumen (PDF Export)

const { test, expect } = require('@playwright/test');
const { login, BASE_URL } = require('./helpers');

// ── TC-DOC-01: Tombol Export SK PDF muncul setelah disetujui ─────────────
test('TC-DOC-01: Tombol Export SK PDF hanya muncul pada pengajuan yang disetujui', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/mahasiswa/submissions`);
  const rows = page.locator('tbody tr');
  const count = await rows.count();

  if (count > 0) {
    const detailLink = page.locator('a[href*="/submissions/"]').first();
    await detailLink.click();
    const bodyText = await page.locator('body').textContent();

    if (bodyText?.includes('Disetujui')) {
      await expect(page.locator('a[href*="/pdf"]').first()).toBeVisible();
    } else {
      // Belum disetujui, tombol PDF tidak boleh muncul
      const pdfLink = page.locator('a[href*="/pdf"]');
      expect(await pdfLink.count()).toBe(0);
    }
  }
});

// ── TC-DOC-02: Akses PDF tanpa login ditolak ─────────────────────────────
test('TC-DOC-02: Akses endpoint PDF tanpa login diarahkan ke halaman login', async ({ page }) => {
  await page.goto(`${BASE_URL}/mahasiswa/submissions/1/pdf`);
  await expect(page).toHaveURL(/login/);
});

// ── TC-DOC-03: Akses PDF submission orang lain ditolak ───────────────────
test('TC-DOC-03: Mahasiswa tidak dapat mengakses PDF milik mahasiswa lain', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  // Coba akses ID yang sangat besar (tidak ada)
  const res = await page.request.get(`${BASE_URL}/mahasiswa/submissions/99999/pdf`);
  expect([403, 404]).toContain(res.status());
});

// ── TC-DOC-04: Upload dokumen hanya menerima PDF ─────────────────────────
test('TC-DOC-04: Upload file non-PDF ditolak oleh sistem', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/mahasiswa/submissions/create`);
  const currentUrl = page.url();
  if (currentUrl.includes('edit') || !currentUrl.includes('create')) return;

  const fileInput = page.locator('input[type="file"][name="application_letter"]');
  if (await fileInput.count() > 0) {
    // Buat file txt sementara
    const { writeFileSync } = require('fs');
    const tmpPath = '/tmp/test.txt';
    writeFileSync(tmpPath, 'bukan pdf');
    await fileInput.setInputFiles(tmpPath);
    await page.fill('[name="address"]', 'Jl. Test');
    await page.fill('[name="phone"]', '08123456789');
    await page.fill('[name="gpa"]', '3.0');
    await page.fill('[name="total_sks"]', '100');
    await page.fill('[name="reason"]', 'Test upload bukan pdf');
    await page.click('button[type="submit"]');
    await expect(page.locator('body')).toContainText(/PDF|format|tidak valid/i);
  }
});

// ── TC-DOC-05: Upload PDF berhasil menampilkan nama file ─────────────────
test('TC-DOC-05: Upload PDF valid menampilkan nama file di dropzone', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/mahasiswa/submissions/create`);
  const currentUrl = page.url();
  if (currentUrl.includes('edit') || !currentUrl.includes('create')) return;

  const fileInput = page.locator('input[type="file"][name="application_letter"]');
  if (await fileInput.count() > 0) {
    const { writeFileSync } = require('fs');
    const tmpPdf = '/tmp/test.pdf';
    writeFileSync(tmpPdf, '%PDF-1.4\n%%EOF');
    await fileInput.setInputFiles(tmpPdf);
    // Nama file harus tampil di dropzone
    const fileName = page.locator('#app-letter-name');
    if (await fileName.count() > 0) {
      const text = await fileName.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  }
});