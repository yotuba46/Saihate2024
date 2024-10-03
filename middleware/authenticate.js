// middleware/authenticate.js
const admin = require('firebase-admin');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '認証トークンが提供されていません' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const user = await User.findOne({ uid: decodedToken.uid });

    if (!user) {
      return res.status(401).json({ success: false, message: 'ユーザー情報が見つかりません' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('認証エラー:', error);
    return res.status(401).json({ success: false, message: '認証エラー' });
  }
};

module.exports = authenticate;
