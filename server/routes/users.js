const router = require("express").Router();
const { promisify } = require("util");
let User = require("../models/user.model");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const passport = require("passport");
// const _ = require('lodash');
const validator = require("validator");
const mailChecker = require("mailchecker");
const randomBytesAsync = promisify(crypto.randomBytes);

const REGISTRATION_SUCCESS = "REGISTRATION_SUCCESS";
const REGISTRATION_FAILURE = "REGISTRATION_FAILURE";
// const User = require('../models/User');

exports.postLogin = (req, res, next) => {
  const validationErrors = [];
  if (!validator.isEmail(req.body.email))
    validationErrors.push({ msg: "Please enter a valid email address." });
  if (validator.isEmpty(req.body.password))
    validationErrors.push({ msg: "Password cannot be blank." });

  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("/login");
  }
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false
  });

  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash("errors", info);
      return res.redirect("/login");
    }
    req.logIn(user, err => {
      if (err) {
        return next(err);
      }
      req.flash("success", { msg: "Success! You are logged in." });
      res.redirect(req.session.returnTo || "/");
    });
  })(req, res, next);
};

exports.postSignup = (req, res, next) => {
  const validationErrors = [];

  if (!validator.isEmail(req.body.email)) {
    validationErrors.push({
      emailError: "Please enter a valid email address."
    });
  }

  if (validator.isEmpty(req.body.userName)) {
    validationErrors.push({
      nameError: "Please choose a userName"
    });
  } else if (!validator.isLength(req.body.userName, { min: 3 })) {
    validationErrors.push({
      nameError: "UserName must be at least 3 characters long"
    });
  }

  if (!validator.isLength(req.body.password, { min: 8 })) {
    validationErrors.push({
      passwordError: "Password must be at least 8 characters long"
    });
  }

  //   if (req.body.password !== req.body.confirmPassword)
  //     validationErrors.push({ msg: "Passwords do not match" });
  if (validationErrors.length >= 2) {
    console.log("validationErrors.length2222");
    req.flash("errors", validationErrors);
    return res.status(400).send({ error: validationErrors });
  } else if (validationErrors.length) {
    console.log("validationErrors.length");
    return res.status(400).send({ error: validationErrors[0] });
  }
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false
  });
  const user = new User({
    profile: {
      name: req.body.userName
    },
    email: req.body.email,
    password: req.body.password
  });
  console.log("req.body.email", req.body.email);
  User.findOne({ email: req.body.email }, (err, existingUser) => {
    if (err) {
      console.log("err3: ", err);
      return next(err);
    }
    if (existingUser) {
      console.log("existingUser", existingUser);
      req.flash("errors", {
        msg: "Account with that email address already exists."
      });
      // 409 code for conflict with dataBase resource.
      return res.status().send(409, {
        error: "Account with that email address already exists."
      });
    }
    user.save(err => {
      if (err) {
        console.log("err: ", err);
        return next(err);
      }
      req.logIn(user, err => {
        if (err) {
          console.log("err2: ", err);
          return next(err);
        }
        console.log("log in");
        return res.send({
          message: REGISTRATION_SUCCESS,
          userObject: req.body,
          returnCode: "1"
        });
      });
    });
  });
};

/**
 * GET /account/verify
 * Verify email address
 */
exports.getVerifyEmail = (req, res, next) => {
  if (req.user.emailVerified) {
    req.flash("info", { msg: "The email address has been verified." });
    return res.redirect("/account");
  }

  if (!mailChecker.isValid(req.user.email)) {
    req.flash("errors", {
      msg:
        "The email address is invalid or disposable and can not be verified.  Please update your email address and try again."
    });
    return res.redirect("/account");
  }

  const createRandomToken = randomBytesAsync(16).then(buf =>
    buf.toString("hex")
  );

  const setRandomToken = token => {
    User.findOne({ email: req.user.email }).then(user => {
      user.emailVerificationToken = token;
      user = user.save();
    });
    return token;
  };

  const sendVerifyEmail = token => {
    let transporter = nodemailer.createTransport({
      service: "SendGrid",
      auth: {
        user: process.env.SENDGRID_USER,
        pass: process.env.SENDGRID_PASSWORD
      }
    });
    const mailOptions = {
      to: req.user.email,
      from: "hackathon@starter.com",
      subject: "Please verify your email address on Hackathon Starter",
      text: `Thank you for registering with hackathon-starter.\n\n
        This verify your email address please click on the following link, or paste this into your browser:\n\n
        http://${req.headers.host}/account/verify/${token}\n\n
        \n\n
        Thank you!`
    };
    return transporter
      .sendMail(mailOptions)
      .then(() => {
        req.flash("info", {
          msg: `An e-mail has been sent to ${req.user.email} with further instructions.`
        });
      })
      .catch(err => {
        if (err.message === "self signed certificate in certificate chain") {
          console.log(
            "WARNING: Self signed certificate in certificate chain. Retrying with the self signed certificate. Use a valid certificate if in production."
          );
          transporter = nodemailer.createTransport({
            service: "SendGrid",
            auth: {
              user: process.env.SENDGRID_USER,
              pass: process.env.SENDGRID_PASSWORD
            },
            tls: {
              rejectUnauthorized: false
            }
          });
          return transporter.sendMail(mailOptions).then(() => {
            req.flash("info", {
              msg: `An e-mail has been sent to ${req.user.email} with further instructions.`
            });
          });
        }
        console.log(
          "ERROR: Could not send verifyEmail email after security downgrade.\n",
          err
        );
        req.flash("errors", {
          msg:
            "Error sending the email verification message. Please try again shortly."
        });
        return err;
      });
  };

  createRandomToken
    .then(setRandomToken)
    .then(sendVerifyEmail)
    .then(() => res.redirect("/account"))
    .catch(next);
};

exports.logout = (req, res) => {
  req.logout();
  req.session.destroy(err => {
    if (err)
      console.log("Error : Failed to destroy the session during logout.", err);
    req.user = null;
    res.redirect("/");
  });
};

exports.postLogin = (req, res, next) => {
  const validationErrors = [];
  if (!validator.isEmail(req.body.email))
    validationErrors.push({ msg: "Please enter a valid email address." });
  if (validator.isEmpty(req.body.password))
    validationErrors.push({ msg: "Password cannot be blank." });

  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("/login");
  }
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false
  });

  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash("errors", info);
      return res.redirect("/login");
    }
    req.logIn(user, err => {
      if (err) {
        return next(err);
      }
      req.flash("success", { msg: "Success! You are logged in." });
      res.redirect(req.session.returnTo || "/");
    });
  })(req, res, next);
};
