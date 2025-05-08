import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { getUserIdFromToken } from "./middlewares/authMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import clients from "./common/websocketClients.js";
import {
  getGroups,
  updateGroup,
  createGroup,
  getGroupChats,
  sendGroupMessage,
  removeUserFromGroup,
} from "./events/group.js";
import { getChats, getChat, sendMessage } from "./events/chats.js";

import {
  searchUser,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
} from "./events/users.js";

dotenv.config();
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const port = 8080;

app.use(cors());
app.use(express.json());
app.use("/app/auth", authRoutes);

wss.on("connection", (ws, req) => {
  const token = req.url.split("=")[1];
  const userId = getUserIdFromToken(token);
  clients.set(userId, ws);
  if (userId) {
    ws.on("message", (message) => {
      const parsedMessage = JSON.parse(message);
      console.log("parsedMessage", parsedMessage);
      const { type, data } = parsedMessage;
      switch (type) {
        case "get_chats_and_group":
          getChats(userId);
          getGroups(userId);
          break;
        case "get_chat":
          getChat(userId, data);
          break;
        case "get_group_chat":
          getGroupChats(userId, data);
          break;
        case "send_group_message":
          sendGroupMessage(userId, data);
          getGroupChats(userId, data);
          break;
        case "send_message":
          sendMessage(userId, data.chatID, data.message);
          getChat(userId, data.chatID);
          break;
        case "search_user":
          searchUser(userId, data);
          break;
        case "get_friend_requests":
          getFriendRequests(userId);
          break;
        case "accept_friend_request":
          acceptFriendRequest(userId, data);
          getChats(userId);
          break;
        case "send_friend_request":
          sendFriendRequest(userId, data);
          break;
        case "create_group":
          createGroup(userId, data);
          break;
        case "update_group":
          updateGroup(userId, data);
          break;
        case "remove_user_from_group":
          removeUserFromGroup(userId, data);
          break;
        default:
          break;
      }
    });

    ws.on("close", () => {
      clients.delete(userId);
    });
  }
});

server.listen(5000, () => console.log(`🚀 Server running on port ${port}`));
