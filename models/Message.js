// models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  roomName: { type: String, required: true }, // メッセージが属する部屋名
  userId: { type: String, required: true }, // Firebaseのuid
  displayName: { type: String, required: true },
  message: { type: String, required: true, maxlength: 200 },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', MessageSchema);
