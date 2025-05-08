import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../config/db.js";

const register = (req, res) => {
  const { full_name, username, email, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  const query =
    "INSERT INTO users (full_name, username, email, password) VALUES (?, ?, ?, ?)";

  db.query(
    query,
    [full_name, username, email, hashedPassword],
    (err, result) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Registration failed", error: err });

      res.json({
        message: "User registered successfully",
        userId: result.insertId,
      });
    }
  );
};

const login = (req, res) => {
  const { email, password } = req.body;

  const query = "SELECT * FROM users WHERE email = ?";

  db.query(query, [email], (err, results) => {
    if (err || results.length === 0)
      return res.status(401).json({ message: "Invalid credentials" });

    const user = results[0];

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
      },
    });
  });
};
export default { login, register };
