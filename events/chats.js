import clients from "../common/websocketClients.js";
import db from "../config/db.js";

const getChats = (userId) => {
  const ws = clients.get(userId);
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

const getChat = (userId, receiverId) => {
  const ws = clients.get(userId);
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
  const toWs = clients.get(receiverId);
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

export { getChats, getChat, sendMessage };
