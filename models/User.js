// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebaseのuid
  username: { type: String, required: true, unique: true },
  isAdmin: { type: Boolean, default: false }, // 管理者フラグ
});

module.exports = mongoose.model('User', UserSchema);
