// models/Room.js
const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

// 参加人数の上限を設定（例: 5人）
RoomSchema.pre('save', function(next) {
  if (this.users.length > 5) {
    return next(new Error('部屋の参加人数が上限に達しています。'));
  }
  next();
});

module.exports = mongoose.model('Room', RoomSchema);
