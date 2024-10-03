// server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const path = require('path');
const cors = require('cors');

// ルートモジュールのインポート
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const userRoutes = require('./routes/users');

// Socket.IOハンドラーのインポート
const socketHandler = require('./socket');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 環境変数からポート番号を取得（デフォルトは3000）
const PORT = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(express.json()); // body-parser の代わりに Express の組み込みミドルウェアを使用

// CORSの設定（必要に応じて）
app.use(cors({
  origin: 'http://localhost:3000', // フロントエンドのドメインを指定
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));

// MongoDBへの接続
const mongoURI = process.env.MONGO_URI; // 環境変数から取得
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDBに接続しました'))
  .catch(err => console.error('MongoDB接続エラー:', err));

// Firebaseの初期化
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT; // 環境変数から取得
const serviceAccount = require(path.resolve(serviceAccountPath));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// ルートの設定（APIルートは静的ファイルよりも先に定義）
app.use('/auth', authRoutes);
app.use('/rooms', roomRoutes);
app.use('/users', userRoutes);

// Socket.IOインスタンスをアプリケーションに設定（ルートファイルからアクセス可能にする場合）
app.set('io', io);

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// ルートにアクセスした際に index.html を提供
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IOのミドルウェア設定
io.use(async (socket, next) => {
  const token = socket.handshake.query.token;
  if (!token) {
    return next(new Error('認証トークンが提供されていません'));
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (!decodedToken.email_verified) {
      return next(new Error('メールアドレスが確認されていません'));
    }

    const user = await mongoose.model('User').findOne({ uid: decodedToken.uid });
    if (!user) {
      return next(new Error('ユーザー情報が見つかりません'));
    }

    socket.user = {
      uid: user.uid,
      displayName: user.username || '匿名',
      isAdmin: user.isAdmin || false,
      _id: user._id, // MongoDBのObjectId
    };
    next();
  } catch (error) {
    console.error('認証エラー:', error);
    next(new Error('認証エラー'));
  }
});

// Socket.IOハンドラーの設定
socketHandler(io);

// エラーハンドラー（オプション）
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ success: false, message: '内部サーバーエラー' });
});

// サーバーの起動
server.listen(PORT, () => {
  console.log(`サーバーがポート${PORT}で起動しました`);
});
