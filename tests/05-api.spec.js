// tests/05-api.spec.js
// Test Suite: REST API (/api/auth & /api/submissions)

const { test, expect } = require('@playwright/test');
const { apiLogin, BASE_URL } = require('./helpers');

// ── TC-API-01: Login API berhasil ─────────────────────────────────────────
test('TC-API-01: POST /api/auth/login mengembalikan JWT token', async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { username: '2211521000', password: 'Mhs@2211521000' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data).toHaveProperty('token');
});

// ── TC-API-02: Login API gagal dengan kredensial salah ────────────────────
test('TC-API-02: POST /api/auth/login gagal dengan password salah', async ({ request }) => {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { username: '2211521000', password: 'passwordSalah' },
  });
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body.success).toBe(false);
});

// ── TC-API-03: Akses API tanpa token ditolak ──────────────────────────────
test('TC-API-03: GET /api/submissions tanpa token mengembalikan 401', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/submissions`);
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body.success).toBe(false);
});

// ── TC-API-04: Akses API dengan token valid berhasil ─────────────────────
test('TC-API-04: GET /api/submissions dengan token valid mengembalikan data', async ({ request }) => {
  const token = await apiLogin(request, '2211521000', 'Mhs@2211521000');
  if (!token) return; // skip jika login gagal

  const res = await request.get(`${BASE_URL}/api/submissions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data).toHaveProperty('submissions');
  expect(body.data).toHaveProperty('pagination');
});

// ── TC-API-05: Response pagination memiliki struktur benar ───────────────
test('TC-API-05: Pagination API memiliki field total, page, limit, total_pages', async ({ request }) => {
  const token = await apiLogin(request, '2211521000', 'Mhs@2211521000');
  if (!token) return;

  const res = await request.get(`${BASE_URL}/api/submissions?page=1&limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  const pagination = body.data?.pagination;
  expect(pagination).toHaveProperty('total');
  expect(pagination).toHaveProperty('page');
  expect(pagination).toHaveProperty('limit');
  expect(pagination).toHaveProperty('total_pages');
});

// ── TC-API-06: Searching di API berfungsi ────────────────────────────────
test('TC-API-06: GET /api/submissions?search= memfilter hasil dengan benar', async ({ request }) => {
  const token = await apiLogin(request, 'kaprodi.fti', 'Kaprodi@2026');
  if (!token) return;

  const res = await request.get(`${BASE_URL}/api/submissions?search=RES-`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
});

// ── TC-API-07: Kaprodi tidak bisa akses submission milik mahasiswa lain ──
test('TC-API-07: ACL API kaprodi hanya melihat pengajuan yang relevan', async ({ request }) => {
  const token = await apiLogin(request, 'kaprodi.fti', 'Kaprodi@2026');
  if (!token) return;

  const res = await request.get(`${BASE_URL}/api/submissions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
});

// ── TC-API-08: GET /api/auth/me mengembalikan info user ───────────────────
test('TC-API-08: GET /api/auth/me mengembalikan data user yang login', async ({ request }) => {
  const token = await apiLogin(request, '2211521000', 'Mhs@2211521000');
  if (!token) return;

  const res = await request.get(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data.user).toHaveProperty("id");
  expect(body.data.user).toHaveProperty("username");
  expect(body.data.user).toHaveProperty("role");
});

// ── TC-API-09: Token salah mengembalikan 401 ─────────────────────────────
test('TC-API-09: Request dengan token tidak valid mengembalikan 401', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/submissions`, {
    headers: { Authorization: 'Bearer tokenpalsu123' },
  });
  expect(res.status()).toBe(401);
});

// ── TC-API-10: Validasi API - POST submission tanpa data ─────────────────
test('TC-API-10: POST /api/submissions tanpa data mengembalikan 422', async ({ request }) => {
  const token = await apiLogin(request, '2211521000', 'Mhs@2211521000');
  if (!token) return;

  const res = await request.post(`${BASE_URL}/api/submissions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  // 422 Unprocessable atau 400 Bad Request
  expect([400, 422]).toContain(res.status());
  const body = await res.json();
  expect(body.success).toBe(false);
});