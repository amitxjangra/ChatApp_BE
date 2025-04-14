const db = require("../config/db");

exports.getConversationWithUser = (req, res) => {
  const userId = req.user.id;
  const { contactId } = req.params;

  const query = `
    SELECT * from chats 
WHERE (sent_by=? AND sent_to=?) OR (sent_by=? AND sent_to=?) 
ORDER BY sent_time;
  `;

  db.query(query, [userId, contactId, contactId, userId], (err, results) => {
    console.log("results");
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

exports.sendMessage = (req, res) => {
  const { message, sent_to } = req.body;
  const sent_by = req.user.id;

  const query = `INSERT INTO chats (sent_by, sent_to, message) VALUES (?, ?, ?)`;

  db.query(query, [sent_by, sent_to, message], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: result.insertId, sent_by, sent_to, message });
  });
};
