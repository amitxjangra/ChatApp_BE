const db = require("../config/db");

exports.searchUsers = (req, res) => {
  const { query } = req.query;
  console.log(query);
  const dbQuery = `SELECT id, full_name, username, email FROM users WHERE email LIKE '%${query}%'`;
  db.query(dbQuery, [], (err, results) => {
    console.log(results);
    res.json(results);
  });
};
