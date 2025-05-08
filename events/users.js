import clients from "../common/websocketClients.js";
import db from "../config/db.js";
import { getChats } from "./chats.js";

const searchUser = (userId, query) => {
  const ws = clients.get(userId);
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
  const ws = clients.get(userId);
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

const sendFriendRequest = (userId, data) => {
  const ws = clients.get(userId);
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
      const ws2 = clients.get(data.id);
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

const acceptFriendRequest = (userId, data) => {
  const ws = clients.get(userId);
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

export {
  searchUser,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
};
