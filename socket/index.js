// socket/index.js
const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');

module.exports = (io) => {
  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`ユーザーが接続しました: ${user.displayName || '匿名'}`);

    // 部屋に参加するイベント
    socket.on('joinRoom', async (roomName) => {
      if (!roomName || roomName.trim() === '') {
        socket.emit('errorMessage', '部屋名が無効です。');
        return;
      }

      try {
        const room = await Room.findOne({ name: roomName.trim() }).populate('users', 'username uid');
        if (!room) {
          socket.emit('errorMessage', '指定された部屋が存在しません。');
          return;
        }

        // 部屋の参加人数制限
        if (room.users.length >= 5) {
          socket.emit('errorMessage', 'この部屋は満員です。');
          return;
        }

        // 多重参加の防止
        const isAlreadyJoined = room.users.some(u => u.uid === user.uid);
        if (isAlreadyJoined) {
          socket.emit('errorMessage', '既にこの部屋に参加しています。');
          return;
        }

        // Socket.IOのルームに参加
        socket.join(roomName.trim());

        // 部屋のユーザーリストに追加
        room.users.push(user._id);
        await room.save();

        // クライアントに成功メッセージ
        socket.emit('joinedRoom', roomName.trim());

        // 部屋内のユーザー一覧を更新
        const updatedRoom = await Room.findOne({ name: roomName.trim() }).populate('users', 'username uid');
        io.to(roomName.trim()).emit('roomUsers', {
          users: updatedRoom.users.map(u => ({ uid: u.uid, username: u.username })),
          creatorUid: updatedRoom.createdBy.toString()
        });

        console.log(`${user.displayName} が部屋 "${roomName.trim()}" に参加しました`);
      } catch (error) {
        console.error('部屋参加エラー:', error);
        socket.emit('errorMessage', '部屋参加中にエラーが発生しました。');
      }
    });

    // 部屋から退出するイベント
    socket.on('leaveRoom', async (roomName) => {
      if (!roomName || roomName.trim() === '') {
        socket.emit('errorMessage', '部屋名が無効です。');
        return;
      }

      try {
        const room = await Room.findOne({ name: roomName.trim() }).populate('users', 'username uid');
        if (!room) {
          socket.emit('errorMessage', '指定された部屋が存在しません。');
          return;
        }

        // Socket.IOのルームから退出
        socket.leave(roomName.trim());

        // 部屋のユーザーリストから削除
        room.users = room.users.filter(u => u.uid !== user.uid);
        await room.save();

        // クライアントに成功メッセージ
        socket.emit('leftRoom', roomName.trim());

        // 部屋内のユーザー一覧を更新
        const updatedRoom = await Room.findOne({ name: roomName.trim() }).populate('users', 'username uid');
        io.to(roomName.trim()).emit('roomUsers', {
          users: updatedRoom.users.map(u => ({ uid: u.uid, username: u.username })),
          creatorUid: updatedRoom.createdBy.toString()
        });

        console.log(`${user.displayName} が部屋 "${roomName.trim()}" から退出しました`);
      } catch (error) {
        console.error('部屋退出エラー:', error);
        socket.emit('errorMessage', '部屋退出中にエラーが発生しました。');
      }
    });

    // 部屋内チャットメッセージの受信
    socket.on('roomMessage', async (data) => {
      const { roomName, message } = data;
      if (!roomName || !message || message.trim() === '') {
        socket.emit('errorMessage', 'メッセージが無効です。');
        return;
      }

      try {
        // メッセージを部屋内の他のユーザーに送信
        io.to(roomName.trim()).emit('receiveRoomMessage', {
          userId: user.uid,
          username: user.displayName || '匿名',
          message: message.trim(),
          timestamp: new Date(),
        });

        // メッセージをデータベースに保存（roomNameを含める）
        const newMessage = new Message({
          roomName: roomName.trim(),
          userId: user.uid,
          displayName: user.displayName || '匿名',
          message: message.trim(),
        });
        await newMessage.save();
        console.log(`メッセージを保存しました: ${message.trim()} in ${roomName.trim()}`);
      } catch (error) {
        console.error('部屋内メッセージ送信エラー:', error);
        socket.emit('errorMessage', 'メッセージ送信中にエラーが発生しました。');
      }
    });

    // 過去のメッセージを送信
    socket.on('requestPreviousMessages', async (roomName) => {
      if (!roomName || roomName.trim() === '') {
        socket.emit('errorMessage', '部屋名が無効です。');
        return;
      }

      try {
        const messages = await Message.find({ roomName: roomName.trim() }).sort({ timestamp: 1 }).limit(50);
        socket.emit('previousRoomMessages', messages);
        console.log(`過去のメッセージを送信しました: ${messages.length}件 in ${roomName.trim()}`);
      } catch (error) {
        console.error('メッセージの取得に失敗しました:', error);
        socket.emit('errorMessage', 'メッセージの取得中にエラーが発生しました。');
      }
    });

    // 切断時の処理
    socket.on('disconnect', async () => {
      console.log('ユーザーが切断しました');

      try {
        // すべての部屋からユーザーを削除
        const rooms = await Room.find({ 'users': user._id });
        for (const room of rooms) {
          room.users = room.users.filter(u => u.toString() !== user._id.toString());
          await room.save();

          // 部屋内のユーザー一覧を更新
          const updatedRoom = await Room.findOne({ name: room.name }).populate('users', 'username uid');
          io.to(room.name).emit('roomUsers', {
            users: updatedRoom.users.map(u => ({ uid: u.uid, username: u.username })),
            creatorUid: updatedRoom.createdBy.toString()
          });

          console.log(`${user.displayName} が部屋 "${room.name}" から退出しました`);
        }
      } catch (error) {
        console.error('切断時の部屋管理エラー:', error);
      }
    });

  });
};
