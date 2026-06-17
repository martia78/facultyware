require('dotenv').config();
const db = require('../lib/db');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    console.log('=== Memulai proses seeding ===\n');

    // ─── 1. ROLES ───────────────────────────────────────────
    console.log('1. Membuat roles...');
    const roles = [
      { name: 'mahasiswa',  guard_name: 'web' },
      { name: 'admin',      guard_name: 'web' },
      { name: 'kaprodi',    guard_name: 'web' },
      { name: 'dekan',      guard_name: 'web' },
    ];

    for (const role of roles) {
      await db.query(
        `INSERT IGNORE INTO roles (name, guard_name, created_at, updated_at)
         VALUES (?, ?, NOW(), NOW())`,
        [role.name, role.guard_name]
      );
    }
    console.log('   ✓ Roles dibuat: mahasiswa, admin, kaprodi, dekan');

    // Ambil ID roles
    const [roleRows] = await db.query('SELECT id, name FROM roles WHERE guard_name = "web"');
    const roleMap = {};
    roleRows.forEach(r => roleMap[r.name] = r.id);

    // ─── 2. PERMISSIONS ─────────────────────────────────────
    console.log('\n2. Membuat permissions...');
    const permissions = [
      // Mahasiswa
      { name: 'submission.create',     guard_name: 'web' },
      { name: 'submission.view-own',   guard_name: 'web' },
      { name: 'submission.download',   guard_name: 'web' },
      // Admin Akademik
      { name: 'submission.view-all',   guard_name: 'web' },
      { name: 'submission.verify',     guard_name: 'web' },
      { name: 'submission.revise',     guard_name: 'web' },
      { name: 'student.manage',        guard_name: 'web' },
      { name: 'submission.export',     guard_name: 'web' },
      // Kaprodi
      { name: 'submission.approve-prodi',  guard_name: 'web' },
      { name: 'submission.reject-prodi',   guard_name: 'web' },
      // Dekan
      { name: 'submission.approve-final',  guard_name: 'web' },
      { name: 'submission.reject-final',   guard_name: 'web' },
    ];

    for (const perm of permissions) {
      await db.query(
        `INSERT IGNORE INTO permissions (name, guard_name, created_at, updated_at)
         VALUES (?, ?, NOW(), NOW())`,
        [perm.name, perm.guard_name]
      );
    }
    console.log(`   ✓ ${permissions.length} permissions dibuat`);

    // Ambil ID permissions
    const [permRows] = await db.query('SELECT id, name FROM permissions');
    const permMap = {};
    permRows.forEach(p => permMap[p.name] = p.id);

    // ─── 3. ROLE HAS PERMISSIONS ────────────────────────────
    console.log('\n3. Memetakan permissions ke roles...');
    const rolePermissions = {
      mahasiswa: [
        'submission.create',
        'submission.view-own',
        'submission.download',
      ],
      admin: [
        'submission.view-all',
        'submission.verify',
        'submission.revise',
        'student.manage',
        'submission.export',
      ],
      kaprodi: [
        'submission.view-all',
        'submission.approve-prodi',
        'submission.reject-prodi',
      ],
      dekan: [
        'submission.view-all',
        'submission.approve-final',
        'submission.reject-final',
        'submission.export',
      ],
    };

    for (const [roleName, perms] of Object.entries(rolePermissions)) {
      const roleId = roleMap[roleName];
      for (const permName of perms) {
        const permId = permMap[permName];
        if (roleId && permId) {
          await db.query(
            `INSERT IGNORE INTO role_has_permissions (permission_id, role_id)
             VALUES (?, ?)`,
            [permId, roleId]
          );
        }
      }
      console.log(`   ✓ ${roleName}: ${perms.length} permissions`);
    }

    // ─── 4. USERS ───────────────────────────────────────────
    console.log('\n4. Membuat user demo...');
    const users = [
      { username: 'mahasiswa01', password: 'password123', name: 'Budi Santoso',   email: 'budi@student.ac.id',   role: 'mahasiswa' },
      { username: 'admin01',     password: 'password123', name: 'Siti Rahayu',    email: 'siti@univ.ac.id',      role: 'admin'     },
      { username: 'kaprodi01',   password: 'password123', name: 'Dr. Ahmad Fauzi', email: 'ahmad@univ.ac.id',   role: 'kaprodi'   },
      { username: 'dekan01',     password: 'password123', name: 'Prof. Hendra W.', email: 'hendra@univ.ac.id',  role: 'dekan'     },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 12);

      // Cek user sudah ada
      const [existing] = await db.query(
        'SELECT id FROM users WHERE username = ?',
        [u.username]
      );

      let userId;
      if (existing.length === 0) {
        const [result] = await db.query(
          `INSERT INTO users (username, name, email, password, created_at, updated_at)
           VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [u.username, u.name, u.email, hash]
        );
        userId = result.insertId;
        console.log(`   ✓ User "${u.username}" dibuat (role: ${u.role})`);
      } else {
        userId = existing[0].id;
        console.log(`   ~ User "${u.username}" sudah ada, skip`);
      }

      // Assign role ke user
      const roleId = roleMap[u.role];
      if (userId && roleId) {
        await db.query(
          `INSERT IGNORE INTO user_has_roles (user_id, role_id) VALUES (?, ?)`,
          [userId, roleId]
        );
      }
    }

    // ─── 5. STUDENT DEMO ────────────────────────────────────
    console.log('\n5. Membuat data mahasiswa demo...');
    // Ambil userId mahasiswa01
    const [mahasiswaUser] = await db.query(
      'SELECT id FROM users WHERE username = ?',
      ['mahasiswa01']
    );

    if (mahasiswaUser.length > 0) {
      const [existingStudent] = await db.query(
        'SELECT id FROM students WHERE id = ?',
        [mahasiswaUser[0].id]
      );

      if (existingStudent.length === 0) {
        await db.query(
          `INSERT INTO students
            (id, name, regno, birth_date, birth_place, gender, email, phone_no, year, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            mahasiswaUser[0].id,
            'Budi Santoso',
            '2021001001',
            '2003-05-15',
            'Jakarta',
            1,
            'budi@student.ac.id',
            '08123456789',
            2021,
            1,
          ]
        );
        console.log('   ✓ Data mahasiswa demo dibuat (NIM: 2021001001)');
      } else {
        console.log('   ~ Data mahasiswa sudah ada, skip');
      }
    }

    console.log('\n=== Seeding selesai! ===');
    console.log('\nAkun demo:');
    console.log('  mahasiswa01 / password123  → role: mahasiswa');
    console.log('  admin01     / password123  → role: admin akademik');
    console.log('  kaprodi01   / password123  → role: ketua program studi');
    console.log('  dekan01     / password123  → role: dekan');

    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error saat seeding:', err.message);
    console.error(err);
    process.exit(1);
  }
}

seed();
