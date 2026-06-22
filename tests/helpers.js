// tests/helpers.js
// Fungsi bantu yang dipakai bersama di semua test file

const BASE_URL = 'http://localhost:3000';

/**
 * Login ke aplikasi web sebagai role tertentu
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @param {string} password
 */
async function login(page, username, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(mahasiswa|kaprodi|wd1|admin|dashboard)/);
}

/**
 * Logout dari aplikasi
 * @param {import('@playwright/test').Page} page
 */
async function logout(page) {
  await page.goto(`${BASE_URL}/logout`);
}

/**
 * Login via REST API, kembalikan JWT token
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} username
 * @param {string} password
 * @returns {Promise<string>} JWT token
 */
async function apiLogin(request, username, password) {
  const response = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { username, password },
  });
  const body = await response.json();
  return body.data?.token || '';
}

module.exports = { login, logout, apiLogin, BASE_URL };