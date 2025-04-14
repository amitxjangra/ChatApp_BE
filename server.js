const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const groupRoutes = require("./routes/groupRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const userRoutes = require("./routes/userRoutes");
const db = require("./config/db");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/app/auth", authRoutes);
app.use("/app/users", userRoutes);
app.use("/app/chat", chatRoutes);
app.use("/api/group", groupRoutes);
app.use("/api/conversations", conversationRoutes);

// WebSocket Connections
const clients = new Map();

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case "chat_message":
          updateChats(data);
          break;
        // case "join":
        //   clients.set(data.userId, ws);
        //   break;

        // case "sendMessage":
        //   handlePrivateMessage(data);
        //   break;

        // case "sendGroupMessage":
        //   handleGroupMessage(data);
        //   break;

        default:
          console.log("Unknown message type:", data);
      }
    } catch (error) {
      console.error("WebSocket error:", error);
    }
  });

  ws.on("close", () => {
    for (const [userId, client] of clients.entries()) {
      if (client === ws) {
        clients.delete(userId);
        break;
      }
    }
  });
});

function updateChats(data) {
  const { sent_by, sent_to, message } = data;
  const query = `INSERT INTO chats (sent_by,sent_to, message) VALUES (?, ?, ?)`;
  db.query(query, [sent_by, sent_to, message], (err, result) => {
    if (err) return console.error(err);
    console.log("Message inserted:", result);
    const chatMessage = {
      type: "receiveMessage",
      // chatId: result.insertId,
      sent_by,
      sent_to,
      message,
      timestamp: new Date(),
    };

    // const socket = clients.get(receiverId);
    // if (socket && socket.readyState === WebSocket.OPEN) {
    //   socket.send(JSON.stringify(chatMessage));
    // }
  });
}

function handlePrivateMessage(data) {
  const { senderId, receiverId, message } = data;

  const query = `INSERT INTO chats (sender_id, receiver_id, message) VALUES (?, ?, ?)`;
  db.query(query, [senderId, receiverId, message], (err, result) => {
    if (err) return console.error(err);

    const chatMessage = {
      type: "receiveMessage",
      chatId: result.insertId,
      senderId,
      receiverId,
      message,
      timestamp: new Date(),
    };

    [senderId, receiverId].forEach((userId) => {
      const socket = clients.get(userId);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(chatMessage));
      }
    });
  });
}

function handleGroupMessage(data) {
  const { senderId, groupId, message } = data;

  const query = `INSERT INTO group_chats (group_id, sender_id, message) VALUES (?, ?, ?)`;
  db.query(query, [groupId, senderId, message], (err, result) => {
    if (err) return console.error(err);

    const groupMessage = {
      type: "receiveGroupMessage",
      chatId: result.insertId,
      senderId,
      groupId,
      message,
      timestamp: new Date(),
    };

    const membersQuery = `SELECT user_id FROM group_members WHERE group_id = ?`;
    db.query(membersQuery, [groupId], (err, members) => {
      if (err) return console.error(err);

      members.forEach(({ user_id }) => {
        const socket = clients.get(user_id);
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(groupMessage));
        }
      });
    });
  });
}

server.listen(5000, () => console.log(`🚀 Server running on port ${port}`));
