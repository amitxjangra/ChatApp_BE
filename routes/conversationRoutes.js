const express = require("express");
const router = express.Router();
const { getConversations } = require("../controllers/conversationController");
const auth = require("../middlewares/authMiddleware");

router.get("/", auth, getConversations);

module.exports = router;
