const express = require("express");
const router = express.Router();
const groupController = require("../controllers/groupController");
const authMiddleware = require("../middlewares/authMiddleware");

// Get all groups
router.get("/all", authMiddleware, groupController.getAllGroups);

// Create a new group
router.post("/create", authMiddleware, groupController.createGroup);

// Add user to group
router.post(
  "/:groupId/add-user",
  authMiddleware,
  groupController.addUserToGroup
);

// Remove user from group (leave group)
router.post(
  "/:groupId/remove-user",
  authMiddleware,
  groupController.removeUserFromGroup
);

// Delete group (admin only)
router.delete("/:groupId", authMiddleware, groupController.deleteGroup);

module.exports = router;
