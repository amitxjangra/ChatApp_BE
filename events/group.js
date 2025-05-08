import clients from "../common/websocketClients.js";
import db from "../config/db.js";

const getGroups = (userId) => {
  const ws = clients.get(userId);
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

const getGroupChats = (userId, group_id) => {
  const ws = clients.get(userId);
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
  const ws = clients.get(userId);
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
                let tempws = clients.get(member.user_id);
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

const createGroup = (userId, data) => {
  const ws = clients.get(userId);
  db.query(
    `insert into groups_list (group_name, description) values (?, ?)`,
    [data.group_name, data.description],
    (err, res) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log("res", res);
      db.query(
        `insert into group_members (group_id,user_id,rights) values(? ,? ,"ADMIN")`,
        [res.insertId, userId],
        (err, res) => {
          if (err) {
            console.error(err);
            return;
          }
          getGroups(userId);
        }
      );
    }
  );
};

const updateGroup = (userId, data) => {
  db.query(
    `update groups_list set group_name=?,description=? where id=?`,
    [data.group_name, data.description, data.group_id],
    (err, res) => {
      if (err) {
        console.error(err);
        return;
      }
      db.query(
        `select * from group_members where group_id=?`,
        [data.group_id],
        (allGroupMemberError, allGroupMembersRes) => {
          if (allGroupMemberError) {
            console.error(allGroupMemberError);
            return;
          }
          allGroupMembersRes.forEach((member) => {
            getGroups(member.user_id);
          });
        }
      );
    }
  );
};

const removeUserFromGroup = (userId, data) => {
  db.query(
    "select * from group_members where group_id=?",
    [data.group_id, userId],
    (err, res) => {
      if (err) {
        console.error(err);
        return;
      }
      if (res.find((i) => i.user_id === userId).rights !== "ADMIN") {
        console.error("permission denied");
        return;
      }
      db.query(
        "delete from group_members where group_id=? AND user_id=?",
        [data.group_id, data.removed_user],
        (deleteErr, deleteRes) => {
          if (deleteErr) {
            console.error(deleteErr);
            return;
          }
          console.log("deleteErr", deleteErr);
          res.forEach((member) => {
            getGroups(member.user_id);
          });
        }
      );
    }
  );
};

export {
  getGroups,
  getGroupChats,
  sendGroupMessage,
  createGroup,
  updateGroup,
  removeUserFromGroup,
};
