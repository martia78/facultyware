require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const { notFoundHandler, errorHandler } = require('./middlewares/error');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.use(session({
  key: 'session_cookie_name',
  secret: process.env.SESSION_SECRET || 'secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// 1. First, require the routers (Initialize them)
const dashboardController = require('./controllers/dashboardController');
const b16Router = require('./routes/b16Routes');

// 2. Then, tell the app to use them
app.use('/b16', b16Router);
app.get('/', dashboardController.index);

app.use('/users', usersRouter);


// catch 404 and forward to error handler
app.use(notFoundHandler);

// error handler
app.use(errorHandler);

module.exports = app;
