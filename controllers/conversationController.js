const db = require("../config/db");

// Get all conversations (private + group)
exports.getConversations = (req, res) => {
  const userId = req.user.id;

  // Step 1: Get private chats
  const privateChatsQuery = `
    SELECT 
      IF(ch.sender_id = ?, ch.receiver_id, ch.sender_id) AS participant_id,
      u.username AS name,
      u.profile_image AS image,
      ch.message AS last_message,
      ch.created_at AS last_message_time,
      'private' AS conversation_type
    FROM chats ch
    JOIN users u ON u.id = IF(ch.sender_id = ?, ch.receiver_id, ch.sender_id)
    WHERE ch.id IN (
      SELECT MAX(id)
      FROM chats
      WHERE sender_id = ? OR receiver_id = ?
      GROUP BY IF(sender_id = ?, receiver_id, sender_id)
    )
  `;

  // Step 2: Get group chats
  const groupChatsQuery = `
    SELECT 
      g.id AS participant_id,
      g.group_name AS name,
      g.group_image AS image,
      ch.message AS last_message,
      ch.created_at AS last_message_time,
      'group' AS conversation_type
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    LEFT JOIN chats ch ON g.last_chat_id = ch.id
    WHERE gm.user_id = ?
  `;

  db.query(
    privateChatsQuery,
    [userId, userId, userId, userId, userId],
    (err, privateResults) => {
      if (err)
        return res.status(500).json({
          message: "Error fetching private conversations",
          error: err,
        });

      db.query(groupChatsQuery, [userId], (err, groupResults) => {
        if (err)
          return res.status(500).json({
            message: "Error fetching group conversations",
            error: err,
          });

        const allConversations = [...privateResults, ...groupResults];

        // Optional: sort by last message time DESC
        allConversations.sort(
          (a, b) =>
            new Date(b.last_message_time) - new Date(a.last_message_time)
        );

        res.json(allConversations);
      });
    }
  );
};
