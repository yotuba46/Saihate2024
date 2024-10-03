// routes/rooms.js
const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const authenticate = require('../middleware/authenticate');

// 部屋を作成するエンドポイント
router.post('/create-room', authenticate, async (req, res) => {
  const { name } = req.body;
  const user = req.user; // 認証ミドルウェアで設定されたユーザー情報

  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, message: '部屋名が必要です。' });
  }

  try {
    // 部屋の重複チェック
    const existingRoom = await Room.findOne({ name: name.trim() });
    if (existingRoom) {
      return res.status(400).json({ success: false, message: '既に同名の部屋が存在します。' });
    }

    // 新規部屋の作成
    const newRoom = new Room({
      name: name.trim(),
      users: [user._id], // 正しく ObjectId を設定
      createdBy: user._id // 正しく ObjectId を設定
    });
    await newRoom.save();

    res.json({ success: true, message: '部屋が作成されました。' });

    // 新しい部屋が作成されたことを全クライアントに通知（リアルタイム更新用）
    req.app.get('io').emit('newRoom', { name: newRoom.name, users: newRoom.users.length });
    console.log(`部屋 "${newRoom.name}" が作成されました。`);
  } catch (error) {
    console.error('部屋の作成エラー:', error);
    res.status(500).json({ success: false, message: 'サーバーエラー' });
  }
});

// 部屋の削除エンドポイント
router.delete('/delete-room/:name', authenticate, async (req, res) => {
  const { name } = req.params;
  const user = req.user;

  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, message: '部屋名が必要です。' });
  }

  try {
    const room = await Room.findOne({ name: name.trim() });
    if (!room) {
      return res.status(404).json({ success: false, message: '指定された部屋が存在しません。' });
    }

    // 部屋の作成者または管理者のみ削除を許可
    if (room.createdBy.toString() !== user._id.toString() && !user.isAdmin) {
      return res.status(403).json({ success: false, message: '権限がありません' });
    }

    // 部屋削除
    await Room.deleteOne({ name: name.trim() });

    // 部屋削除を全クライアントに通知
    req.app.get('io').emit('roomDeleted', { name: room.name });

    res.json({ success: true, message: '部屋が削除されました。' });
    console.log(`部屋 "${room.name}" が削除されました。`);
  } catch (error) {
    console.error('部屋削除エラー:', error);
    res.status(500).json({ success: false, message: 'サーバーエラー' });
  }
});

// 部屋の一覧を取得するエンドポイント
router.get('/list', async (req, res) => { // /rooms/list に変更
  try {
    const rooms = await Room.find({}, 'name users createdBy')
      .populate('users', 'username uid');
    res.json({ success: true, rooms });
  } catch (error) {
    console.error('部屋一覧取得エラー:', error);
    res.status(500).json({ success: false, message: 'サーバーエラー' });
  }
});

module.exports = router;
