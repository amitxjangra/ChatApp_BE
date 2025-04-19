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
WHERE (c.user_1 = ? OR c.user_2 = ?) and c.status="FRIEND";`,
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
    `SELECT 
    gl.id AS group_id,
    gl.group_name,
    gl.last_message,
    u.id,
    u.full_name,
    u.username,
    u.email,
    gm.rights
FROM 
    group_members AS gm
JOIN 
    groups_list AS gl ON gm.group_id = gl.id
JOIN 
    users AS u ON gm.user_id = u.id
WHERE 
    gm.group_id IN (
        SELECT group_id 
        FROM group_members 
        WHERE user_id = ?
    )
ORDER BY 
    gl.id, u.full_name;`,
    [userId],
    (err, result) => {
      if (err) {
        console.error(err);
        return;
      }

      const groups = result.reduce((acc, row) => {
        const {
          group_id,
          group_name,
          id,
          full_name,
          last_message,
          username,
          email,
          rights,
        } = row;

        // Find the group in the accumulator
        let group = acc.find((group) => group.group_id === group_id);

        // If group doesn't exist, create a new one and add to the array
        if (!group) {
          group = {
            group_id,
            group_name,
            last_message,
            users: [],
          };
          acc.push(group);
        }

        // Add the user to the group
        group.users.push({
          id,
          full_name,
          username,
          email,
          rights,
        });

        return acc;
      }, []);

      const message = JSON.stringify({
        type: "get_groups",
        data: groups,
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
  if (!toWs) {
    db.query(
      `INSERT INTO chats (sent_by, sent_to, message,seen) VALUES (?, ?, ?,false)`,
      [userId, receiverId, message],
      (err, res) => {
        if (err) {
          console.log(err);
          return;
        }
        return;
      }
    );
    return;
  }
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

const searchUser = (userId, query) => {
  console.log("query", query);
  const ws = client.get(userId);
  if (!ws) return;
  db.query(
    `SELECT 
  u.id,
  u.full_name,
  u.username,
  u.email,
  c.status
FROM users u
LEFT JOIN connections c 
  ON (
    (c.user_1 = ? AND c.user_2 = u.id) OR
    (c.user_2 = ? AND c.user_1 = u.id)
  )
WHERE u.id != ? AND c.status IS null
  AND (
    u.full_name LIKE ? OR
    u.username LIKE ?
  )
  limit 7;`,
    [userId, userId, userId, `%${query}%`, `%${query}%`],
    (err, result) => {
      if (err) {
        console.error(err);
        return;
      }
      const message = JSON.stringify({
        type: "search_user",
        data: result,
      });
      ws.send(message);
    }
  );
};

const getFriendRequests = (userId) => {
  const ws = client.get(userId);
  if (!ws) return;
  db.query(
    `select u.id, u.full_name ,u.username, u.email from users u
join connections c
on u.id=c.user_2
where status=c.user_2 and c.user_1=?`,
    [userId],
    (err, result) => {
      if (err) {
        console.error(err);
        return;
      }
      const message = JSON.stringify({
        type: "get_friend_requests",
        data: result,
      });
      ws.send(message);
    }
  );
};

const acceptFriendRequest = (userId, data) => {
  const ws = client.get(userId);
  if (!ws) return;
  db.query(
    `update connections 
    set status="FRIEND" 
    where ((user_1=? AND user_2=?) OR (user_1=? AND user_2=?)) limit 1;`,
    [userId, data.id, data.id, userId],
    (err, result) => {
      if (err) {
        console.error(err);
        return;
      }
      const message = JSON.stringify({
        type: "accept_friend_request",
        data: { id: data.id },
      });
      ws.send(message);
      getChats(data.id);
    }
  );
};

const sendFriendRequest = (userId, data) => {
  const ws = client.get(userId);
  if (!ws) return;
  db.query(
    `insert into connections (user_1, user_2, status) values (?, ?,?)`,
    [data.id, userId, userId],
    (err, res) => {
      if (err) {
        console.error(err);
        return;
      }
      const message = JSON.stringify({
        type: "send_friend_request",
        data: { id: data.id },
      });
      ws.send(message);
      const ws2 = client.get(data.id);
      if (!ws2) return;
      db.query(
        `select id,full_name,username,email from users where id=?`,
        [userId],
        (getErr, getRes) => {
          if (getErr) {
            console.error(getErr);
            return;
          }
          const message2 = JSON.stringify({
            type: "get_friend_requests",
            data: getRes,
          });
          ws2.send(message2);
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
          getGroupChats(userId, data);
          break;
        case "send_message":
          sendMessage(userId, data.chatID, data.message);
          getChat(userId, data.chatID);
          break;
        case "search_user":
          searchUser(userId, data);
          break;
        case "get_friend_requests":
          getFriendRequests(userId);
          break;
        case "accept_friend_request":
          acceptFriendRequest(userId, data);
          getChats(userId);
          break;
        case "send_friend_request":
          sendFriendRequest(userId, data);
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
