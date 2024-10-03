// routes/users.js
const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');

// 部屋をキックするエンドポイント（管理者のみ）
router.post('/kick-user', authenticate, async (req, res) => {
  const { roomName, userIdToKick } = req.body;
  const user = req.user;

  if (!roomName || !userIdToKick) {
    return res.status(400).json({ success: false, message: '必要な情報が提供されていません。' });
  }

  try {
    const room = await Room.findOne({ name: roomName.trim() }).populate('users', 'username uid');
    if (!room) {
      return res.status(404).json({ success: false, message: '指定された部屋が存在しません。' });
    }

    // 部屋の作成者または管理者のみキックを許可
    if (room.createdBy.toString() !== user._id.toString() && !user.isAdmin) {
      return res.status(403).json({ success: false, message: '権限がありません' });
    }

    const userToKick = room.users.find(u => u.uid === userIdToKick);
    if (!userToKick) {
      return res.status(404).json({ success: false, message: '指定されたユーザーが部屋に参加していません。' });
    }

    // Socket.IOのルームから退出
    const io = req.app.get('io');
    const sockets = await io.in(roomName.trim()).fetchSockets();
    sockets.forEach(s => {
      if (s.user.uid === userIdToKick) {
        s.leave(roomName.trim());
        s.emit('kicked', roomName.trim());
      }
    });

    // 部屋のユーザーリストから削除
    room.users = room.users.filter(u => u.uid !== userIdToKick);
    await room.save();

    // 部屋内のユーザー一覧を更新
    const updatedRoom = await Room.findOne({ name: roomName.trim() }).populate('users', 'username uid');
    io.to(roomName.trim()).emit('roomUsers', {
      users: updatedRoom.users.map(u => ({ uid: u.uid, username: u.username })),
      creatorUid: updatedRoom.createdBy.toString()
    });

    res.json({ success: true, message: 'ユーザーがキックされました。' });
    console.log(`${userToKick.username} が部屋 "${room.name}" からキックされました。`);
  } catch (error) {
    console.error('ユーザーキックエラー:', error);
    res.status(500).json({ success: false, message: 'サーバーエラー' });
  }
});

module.exports = router;
