// routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');

// ユーザー名の一意性を確認するエンドポイント
router.post('/check-username', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ isUnique: false, message: 'ユーザー名が提供されていません' });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      res.json({ isUnique: false });
    } else {
      res.json({ isUnique: true });
    }
  } catch (error) {
    console.error('ユーザー名の確認に失敗しました:', error);
    res.status(500).json({ isUnique: false });
  }
});

// ユーザー情報を保存するエンドポイント
router.post('/save-user', async (req, res) => {
  const { uid, username, isAdmin } = req.body;

  if (!uid || !username) {
    return res.status(400).json({ success: false, message: 'uidとusernameが必要です。' });
  }

  try {
    // 既にユーザーが存在するか確認
    const existingUser = await User.findOne({ uid });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'ユーザーが既に存在します。' });
    }

    const newUser = new User({ uid, username, isAdmin: isAdmin || false });
    await newUser.save();
    res.json({ success: true });
  } catch (error) {
    console.error('ユーザー情報の保存に失敗しました:', error);
    res.status(500).json({ success: false, message: 'サーバーエラー' });
  }
});

// ユーザー情報を取得するエンドポイント
router.get('/get-user-info', authenticate, async (req, res) => {
  const user = req.user; // 認証ミドルウェアで設定されたユーザー情報
  res.json({ success: true, user: { uid: user.uid, isAdmin: user.isAdmin } });
});

module.exports = router;
