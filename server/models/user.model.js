const bcrypt = require('bcrypt')
const crypto = require('crypto')
const mongoose = require('mongoose')

const Schema = mongoose.Schema

const userSchema = new Schema(
  {
    email: { type: String, unique: true },
    profile: {
      name: { type: String, unique: true, required: true }
      // gender: String,
      // location: String,
      // website: String,
      // picture: String
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    password: String,
    emailVerificationToken: String,
    emailVerified: Boolean,
    google: String,
    facebook: String,
    tokens: Array
  },
  {
    timestamps: true
  }
)

userSchema.pre('save', function save (next) {
  const user = this
  if (!user.isModified('password')) {
    return next()
  }
  bcrypt.genSalt(10, (err, salt) => {
    if (err) {
      return next(err)
    }
    bcrypt.hash(user.password, salt, (err, hash) => {
      if (err) {
        return next(err)
      }
      user.password = hash
      next()
    })
  })
})

userSchema.methods.comparePassword = function comparePassword (
  candidatePassword,
  cb
) {
  bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
    cb(err, isMatch)
  })
}

userSchema.methods.gravatar = function gravatar (size) {
  if (!size) {
    size = 200
  }
  if (!this.email) {
    return `https://gravatar.com/avatar/?s=${size}&d=retro`
  }
  const md5 = crypto
    .createHash('md5')
    .update(this.email)
    .digest('hex')
  return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`
}

const User = mongoose.model('User', userSchema)

module.exports = User
