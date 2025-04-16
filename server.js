const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
require("dotenv").config();
const { getUserIdFromToken } = require("./middlewares/authMiddleware");

const authRoutes = require("./routes/authRoutes");
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

const client = new Map();
//write function to get all chats and groups of a user using jwt
const getChats = (userId) => {
  const ws = client.get(userId);
  if (!ws) return;
  db.query(
    `SELECT u.id ,u.full_name, u.username, u.email
FROM connections c
JOIN users u 
ON ((c.user_1 =? AND u.id = c.user_2) 
OR (c.user_2 = ? AND u.id = c.user_1))
WHERE c.user_1 = ? OR c.user_2 = ?;`,
    [userId, userId, userId, userId],
    (err, result) => {
      if (err) {
        console.error(err);
        return;
      }
      const message = JSON.stringify({
        type: "get_chats",
        data: result,
      });
      ws.send(message);
    }
  );
};

const getGroups = (userId) => {
  const ws = client.get(userId);
  if (!ws) return;
  db.query(
    `SELECT gl.id AS group_id, gl.group_name,gl.last_message
FROM group_members gm
JOIN groups_list gl ON gm.group_id = gl.id
WHERE gm.user_id = ?;`,
    [userId],
    (err, result) => {
      if (err) {
        console.error(err);
        return;
      }
      const message = JSON.stringify({
        type: "get_groups",
        data: result,
      });
      ws.send(message);
    }
  );
};

const getChat = (userId, receiverId) => {
  const ws = client.get(userId);
  if (!ws) return;
  db.query(
    `select *
from chats
where (sent_by=? AND sent_to=?) OR (sent_by=? AND sent_to=?)
order by sent_time;`,
    [userId, receiverId, receiverId, userId],
    (err, result) => {
      if (err) {
        console.error(err);
        return;
      }
      const message = JSON.stringify({
        type: "get_chat_data",
        data: result,
        extra_data: { chatID: receiverId },
      });
      ws.send(message);
    }
  );
};

const sendMessage = (userId, receiverId, message) => {
  const toWs = client.get(receiverId);
  if (!toWs) return;
  db.query(
    `INSERT INTO chats (sent_by, sent_to, message) VALUES (?, ?, ?)`,
    [userId, receiverId, message],
    (err, result) => {
      if (err) {
        console.error(err);
        return;
      }

      db.query(
        `SELECT * from chats where id=?`,
        [result.insertId],
        (err, result) => {
          if (err) {
            console.error(err);
            return;
          }
          const messageData = JSON.stringify({
            type: "chat_message",
            data: result,
          });
          toWs.send(messageData);
        }
      );
    }
  );
};

const getGroupChats = (userId, group_id) => {
  const ws = client.get(userId);
  if (!ws) return;

  db.query(
    `select * from group_chats where group_id=? order by sent_time`,
    [group_id],
    (err, result) => {
      if (err) {
        console.error(err);
        return;
      }
      const messageData = JSON.stringify({
        type: "group_chat_message",
        data: result,
      });
      ws.send(messageData);
    }
  );
};

const sendGroupMessage = (userId, data) => {
  const ws = client.get(userId);
  if (!ws) return;

  db.query(
    `Insert into group_chats(group_id,sent_by,message) values(?,?,?)`,
    [data.chatID, userId, data.message],
    (insertErr, insertResult) => {
      if (insertErr) {
        console.error(insertErr);
        return;
      }
      db.query(
        `select * from group_chats where group_id=?`,
        [data.chatID],
        (groupChatsError, groupChatsResult) => {
          if (groupChatsError) {
            console.error(groupChatsError);
            return;
          }
          db.query(
            `select user_id from group_members
          where group_id=?`,
            [data.chatID],
            (groupMembersError, groupMembersResult) => {
              if (groupMembersError) {
                console.error(groupMembersError);
                return;
              }
              groupMembersResult.forEach((member) => {
                let tempws = client.get(member.user_id);
                if (!tempws) {
                  console.log("user not active", member.user_id);
                } else {
                  let messageData = JSON.stringify({
                    type: "group_chat_message",
                    data: groupChatsResult,
                  });
                  tempws.send(messageData);
                }
              });
            }
          );
        }
      );
    }
  );
};

wss.on("connection", (ws, req) => {
  const token = req.url.split("=")[1];
  const userId = getUserIdFromToken(token);
  client.set(userId, ws);
  if (userId) {
    ws.on("message", (message) => {
      const parsedMessage = JSON.parse(message);
      console.log("parsedMessage", parsedMessage);
      const { type, data } = parsedMessage;
      let result = { key: "help" };
      switch (type) {
        case "get_chats_and_group":
          getChats(userId);
          getGroups(userId);
          break;
        case "get_chat":
          getChat(userId, data);
          break;
        case "get_group_chat":
          getGroupChats(userId, data);
          break;
        case "send_group_message":
          sendGroupMessage(userId, data);
          break;
        case "send_message":
          sendMessage(userId, data.chatID, data.message);
          getChat(userId, data.chatID);
          // sendMessageToReceiver(
          //   userId,
          //   data.chatID,
          //   data.message,
          //   client.get(data.chatID)
          // );
          break;
        default:
          break;
      }
    });

    ws.on("close", () => {
      client.delete(userId);
    });
  }
});

server.listen(5000, () => console.log(`🚀 Server running on port ${port}`));
