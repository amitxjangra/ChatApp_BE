const db = require("../config/db");

// ✅ Get all groups
exports.getAllGroups = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT g.id, g.name, g.description, g.created_at 
    FROM chatgroups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// ✅ Create new group
exports.createGroup = (req, res) => {
  const userId = req.user.id;
  const { name, description } = req.body;

  const createGroupQuery = `INSERT INTO chatgroups (name, description, admin_id) VALUES (?, ?, ?)`;

  db.query(createGroupQuery, [name, description, userId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    const groupId = result.insertId;

    const addCreatorAsMemberQuery = `INSERT INTO group_members (group_id, user_id) VALUES (?, ?)`;

    db.query(addCreatorAsMemberQuery, [groupId, userId], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ message: "Group created successfully", groupId });
    });
  });
};

// ✅ Add user to group
exports.addUserToGroup = (req, res) => {
  const { groupId } = req.params;
  const { userIdToAdd } = req.body;
  const userId = req.user.id;

  const checkAdminQuery = `SELECT admin_id FROM chatgroups WHERE id = ?`;

  db.query(checkAdminQuery, [groupId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0)
      return res.status(404).json({ error: "Group not found" });

    if (results[0].admin_id !== userId)
      return res.status(403).json({ error: "Only admin can add users" });

    const addUserQuery = `INSERT INTO group_members (group_id, user_id) VALUES (?, ?)`;

    db.query(addUserQuery, [groupId, userIdToAdd], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ message: "User added to group" });
    });
  });
};

// ✅ Remove user from group (leave group)
exports.removeUserFromGroup = (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  const removeUserQuery = `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`;

  db.query(removeUserQuery, [groupId, userId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "You are not a member of this group" });
    }

    res.json({ message: "You have left the group" });
  });
};

// ✅ Delete group (admin only)
exports.deleteGroup = (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  const checkAdminQuery = `SELECT admin_id FROM chatgroups WHERE id = ?`;

  db.query(checkAdminQuery, [groupId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0)
      return res.status(404).json({ error: "Group not found" });

    if (results[0].admin_id !== userId)
      return res.status(403).json({ error: "Only admin can delete the group" });

    const deleteGroupQuery = `DELETE FROM chatgroups WHERE id = ?`;

    db.query(deleteGroupQuery, [groupId], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ message: "Group deleted successfully" });
    });
  });
};
