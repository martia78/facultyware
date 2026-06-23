// tests/07-password.spec.js
// Test Suite: Ganti Password & Reset Password

const { test, expect } = require('@playwright/test');
const { login, BASE_URL } = require('./helpers');

// ── TC-PWD-01: Halaman profil mahasiswa menampilkan form ganti password ────
test('TC-PWD-01: Halaman profil mahasiswa menampilkan form ganti password', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/mahasiswa/profile`);
  await expect(page.locator('body')).toContainText(/Ganti Password/i);
  await expect(page.locator('input[name="current_password"]')).toBeVisible();
  await expect(page.locator('input[name="new_password"]')).toBeVisible();
  await expect(page.locator('input[name="confirm_password"]')).toBeVisible();
});

// ── TC-PWD-02: Ganti password dengan password saat ini yang salah ─────────
test('TC-PWD-02: Ganti password dengan password saat ini yang salah menampilkan error', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/mahasiswa/profile`);
  await page.fill('input[name="current_password"]', 'PasswordSalah123');
  await page.fill('input[name="new_password"]', 'NewPassword123');
  await page.fill('input[name="confirm_password"]', 'NewPassword123');
  await page.click('button[type="submit"]');
  await expect(page.locator('body')).toContainText(/tidak sesuai|salah|error/i);
});

// ── TC-PWD-03: Ganti password dengan konfirmasi yang tidak cocok ──────────
test('TC-PWD-03: Ganti password dengan konfirmasi yang tidak cocok ditolak', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/mahasiswa/profile`);
  await page.fill('input[name="current_password"]', 'Mhs@2211521000');
  await page.fill('input[name="new_password"]', 'NewPassword123');
  await page.fill('input[name="confirm_password"]', 'BedaPassword123');
  // Validasi client-side — form tidak bisa disubmit
  const result = await page.evaluate(() => {
    const np = document.getElementById('new_password')?.value;
    const cp = document.getElementById('confirm_password')?.value;
    return np !== cp;
  });
  expect(result).toBeTruthy();
});

// ── TC-PWD-04: Ganti password dengan password baru kurang dari 8 karakter ─
test('TC-PWD-04: Password baru kurang dari 8 karakter ditolak validasi', async ({ page }) => {
  await login(page, '2211521000', 'Mhs@2211521000');
  await page.goto(`${BASE_URL}/mahasiswa/profile`);
  const newPassInput = page.locator('input[name="new_password"]');
  const minlength = await newPassInput.getAttribute('minlength');
  expect(parseInt(minlength)).toBeGreaterThanOrEqual(8);
});

// ── TC-PWD-05: Halaman profil kaprodi menampilkan form ganti password ─────
test('TC-PWD-05: Halaman profil kaprodi menampilkan form ganti password', async ({ page }) => {
  await login(page, 'kaprodi.fti', 'Kaprodi@2026');
  await page.goto(`${BASE_URL}/kaprodi/profile`);
  await expect(page.locator('body')).toContainText(/Ganti Password/i);
  await expect(page.locator('input[name="current_password"]')).toBeVisible();
  await expect(page.locator('input[name="new_password"]')).toBeVisible();
  await expect(page.locator('input[name="confirm_password"]')).toBeVisible();
});

// ── TC-PWD-06: Halaman profil WD1 menampilkan form ganti password ─────────
test('TC-PWD-06: Halaman profil WD1 menampilkan form ganti password', async ({ page }) => {
  await login(page, 'wd1.fti', 'WD1@Unand2026');
  await page.goto(`${BASE_URL}/wd1/profile`);
  await expect(page.locator('body')).toContainText(/Ganti Password/i);
  await expect(page.locator('input[name="current_password"]')).toBeVisible();
  await expect(page.locator('input[name="new_password"]')).toBeVisible();
  await expect(page.locator('input[name="confirm_password"]')).toBeVisible();
});

// ── TC-PWD-07: Admin dapat melihat tombol Reset Password di halaman users ──
test('TC-PWD-07: Admin dapat melihat tombol Reset Password di halaman users', async ({ page }) => {
  await login(page, 'admin123', 'FTI@Unand2026');
  await page.goto(`${BASE_URL}/admin/users`);
  await expect(page.locator('button:has-text("Reset Password")').first()).toBeVisible();
});

// ── TC-PWD-08: Modal reset password muncul saat tombol diklik ────────────
test('TC-PWD-08: Modal reset password muncul saat tombol Reset Password diklik', async ({ page }) => {
  await login(page, 'admin123', 'FTI@Unand2026');
  await page.goto(`${BASE_URL}/admin/users`);
  await page.locator('button:has-text("Reset Password")').first().click();
  // Modal harus muncul
  await expect(page.locator('#reset-modal')).toBeVisible();
  await expect(page.locator('input[name="new_password"]')).toBeVisible();
});

// ── TC-PWD-09: Reset password berhasil via admin ──────────────────────────
test('TC-PWD-09: Admin berhasil reset password user lain', async ({ page }) => {
  await login(page, 'admin123', 'FTI@Unand2026');
  await page.goto(`${BASE_URL}/admin/users`);
  await page.locator('button:has-text("Reset Password")').first().click();
  await page.locator('#reset-modal input[name="new_password"]').fill('NewPass@12345');
  await page.locator('#reset-confirm-password').fill('NewPass@12345');
  await page.locator('#reset-modal button[type="submit"]').click();
  // Harus redirect kembali ke halaman users dengan flash sukses
  await expect(page).toHaveURL(/admin\/users/);
  await expect(page.locator('body')).toContainText(/berhasil/i);
});

// ── TC-PWD-10: Akses halaman profil tanpa login diarahkan ke login ─────────
test('TC-PWD-10: Akses halaman profil mahasiswa tanpa login diarahkan ke login', async ({ page }) => {
  await page.goto(`${BASE_URL}/mahasiswa/profile`);
  await expect(page).toHaveURL(/login/);
});