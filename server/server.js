/**
 * Module dependencies.
 */
const express = require('express')
const session = require('express-session')
const dotenv = require('dotenv')
const cors = require('cors')
const mongoose = require('mongoose')
var fs = require('fs')
var https = require('https')
// const compression = require("compression");
const bodyParser = require('body-parser')
// const logger = require("morgan");
// const chalk = require("chalk");
// const errorHandler = require("errorhandler");
// const lusca = require("lusca");

const MongoStore = require('connect-mongodb-session')(session)
const flash = require('express-flash')
// const path = require("path");

const passport = require('passport')

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.config({ path: '.env' })

/**
 * API keys and Passport configuration.
 */
const passportConfig = require('./config/passport')

/**
 * Create Express server.
 */
const app = express()
app.set('port', process.env.PORT || 3000)
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
const uri = process.env.ATLAS_URI

/**
 * Connect to MongoDB.
 */
mongoose.set('useFindAndModify', false)
mongoose.set('useCreateIndex', true)
mongoose.set('useNewUrlParser', true)
mongoose.set('useUnifiedTopology', true)
mongoose.connect(uri, { useNewUrlParser: true })
const connection = mongoose.connection
connection.once('open', () => {
  console.log('MongoDB DATABASE CONNECTION ESTABLISHED SUCCESSFULLY')
})

app.use(
  session({
    resave: true,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET,
    cookie: { maxAge: 1209600000 }, // two weeks in milliseconds
    store: new MongoStore({
      url: process.env.MONGODB_URI,
      autoReconnect: true
    })
  })
)
app.use(passport.initialize())
app.use(passport.session())
app.use(flash())

const usersRouter = require('./routes/users')
app.post('/signup', usersRouter.postSignup)
app.post('/signin', usersRouter.postLogin)

app.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets.readonly'
    ],
    accessType: 'offline',
    prompt: 'consent'
  })
)

// app.get(
//   '/auth/google/callback',
//   passport.authenticate('google', { failureRedirect: '/login' }),
//   (req, res) => {
//     res.redirect(req.session.returnTo || '/')
//   }
// )

/*https.createServer(options, app) */ app.listen(app.get('port'), () => {
  console.log(
    '%s App is running at https://localhost:%d in %s mode',
    // chalk.green("✓"),
    app.get('port'),
    app.get('env')
  )
  console.log('  Press CTRL-C to stop\n')
})

// module.exports = app;
