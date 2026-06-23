require('dotenv').config();

const express    = require('express');
const path       = require('path');
const cookieParser = require('cookie-parser');
const logger     = require('morgan');
const session    = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const { notFoundHandler, errorHandler } = require('./middlewares/error');
const usersRouter = require('./routes/users');

const app = express();

// ─── View engine ───────────────────────────────────────────
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ─── Middleware umum ───────────────────────────────────────
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// CATATAN: /uploads SENGAJA tidak di-serve secara static.
// Akses file upload harus melalui endpoint /document yang dilindungi ACL,
// bukan langsung via URL. Lihat submissionController.js -> viewDocument().


// ─── Session dengan MySQL store ───────────────────────────
const sessionStore = new MySQLStore({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'facultyware',
});

app.use(session({
  key:    'resign_sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-ganti-di-production',
  store:  sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge:   1000 * 60 * 60 * 8, // 8 jam
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
  },
}));

// ─── Variabel global untuk semua view ─────────────────────
app.use((req, res, next) => {
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    username: req.session.username,
    name: req.session.name,
    role: req.session.role,
  } : null;

  res.locals.appName = 'Sistem Pengunduran Diri';

  next();
});

// ─── Routes ───────────────────────────────────────────────
// 1. First, require the routers (Initialize them)
const dashboardController = require('./controllers/dashboardController');
const indexRouter = require('./routes/index'); // Martia's auth/login routes

app.get('/', dashboardController.index);

// 3. RECONNECT MARTIA'S MAIN VIEWS (Login, Index, dll)
app.use('/', indexRouter); 

// 4. Martia's Role Routes
app.use('/mahasiswa', require('./routes/mahasiswa'));
app.use('/admin',     require('./routes/admin'));
app.use('/kaprodi',   require('./routes/kaprodi'));
app.use('/wd1',     require('./routes/wd1'));
app.use('/api',       require('./routes/api'));

// ─── Error handler ────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
