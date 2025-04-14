const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get(
  "/conversation/:contactId",
  authMiddleware,
  chatController.getConversationWithUser
);

router.post("/send", authMiddleware, chatController.sendMessage);

module.exports = router;
