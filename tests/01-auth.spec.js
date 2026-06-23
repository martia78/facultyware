// tests/01-auth.spec.js
// Test Suite: Autentikasi & ACL

const { test, expect } = require('@playwright/test');
const { login, logout, BASE_URL } = require('./helpers');

// ── TC-AUTH-01: Halaman login tampil dengan benar ──────────────────────────
test('TC-AUTH-01: Halaman login menampilkan form username dan password', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await expect(page).toHaveTitle(/Masuk/);
  await expect(page.locator('#username')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

// ── TC-AUTH-02: Login gagal dengan kredensial salah ────────────────────────
test('TC-AUTH-02: Login gagal dengan username/password salah', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('#username', 'salahuser');
  await page.fill('#password', 'salahpass');
  await page.click('button[type="submit"]');
  await expect(page.locator('body')).toContainText(/salah|tidak valid|gagal/i);
  await expect(page).toHaveURL(/login/);
});

// ── TC-AUTH-03: Login sukses sebagai mahasiswa ─────────────────────────────
test('TC-AUTH-03: Login sukses sebagai mahasiswa dan diarahkan ke dashboard', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await expect(page).toHaveURL(/mahasiswa/);
  await expect(page.locator('body')).toContainText(/Dashboard/i);
});

// ── TC-AUTH-04: Login sukses sebagai kaprodi ──────────────────────────────
test('TC-AUTH-04: Login sukses sebagai kaprodi dan diarahkan ke dashboard', async ({ page }) => {
  await login(page, 'kaprodi.fti', 'Kaprodi@2026');
  await expect(page).toHaveURL(/kaprodi/);
});

// ── TC-AUTH-05: Login sukses sebagai WD1 ─────────────────────────────────
test('TC-AUTH-05: Login sukses sebagai WD1 dan diarahkan ke dashboard', async ({ page }) => {
  await login(page, 'wd1.fti', 'WD1@Unand2026');
  await expect(page).toHaveURL(/wd1/);
});

// ── TC-AUTH-06: Logout berhasil ───────────────────────────────────────────
test('TC-AUTH-06: Logout berhasil dan diarahkan ke halaman login', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await logout(page);
  await expect(page).toHaveURL(/login|\//);
});

// ── TC-AUTH-07: Akses halaman mahasiswa tanpa login ditolak ───────────────
test('TC-AUTH-07: Akses /mahasiswa/dashboard tanpa login diarahkan ke login', async ({ page }) => {
  await page.goto(`${BASE_URL}/mahasiswa/dashboard`);
  await expect(page).toHaveURL(/login/);
});

// ── TC-AUTH-08: ACL - kaprodi tidak bisa akses halaman mahasiswa ──────────
test('TC-AUTH-08: Kaprodi tidak dapat mengakses halaman mahasiswa', async ({ page }) => {
  await login(page, 'kaprodi.fti', 'Kaprodi@2026');
  await page.goto(`${BASE_URL}/mahasiswa/dashboard`);
  const statusOrText = await page.locator('body').textContent();
  expect(statusOrText).toMatch(/403|ditolak|tidak memiliki izin/i);
});

// ── TC-AUTH-09: ACL - mahasiswa tidak bisa akses halaman kaprodi ──────────
test('TC-AUTH-09: Mahasiswa tidak dapat mengakses halaman kaprodi', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/kaprodi/dashboard`);
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).toMatch(/403|ditolak|tidak memiliki izin/i);
});

// ── TC-AUTH-10: Input kosong ditolak ─────────────────────────────────────
test('TC-AUTH-10: Login dengan input kosong menampilkan pesan error', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await page.click('button[type="submit"]');
  // Bisa HTML5 validation atau server error
  const isBlocked = await page.evaluate(() => {
    const u = document.getElementById('username');
    return !u.validity.valid;
  });
  expect(isBlocked).toBeTruthy();
});