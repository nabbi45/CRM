import express from "express";
import { PORT, connection } from "./db/config.js";
import UserRoutes from "./routes/Userroutes.js";
import BookingRoutes from "./routes/BookingRoute.js";
import ServiceRoutes from "./routes/ServiceRoute.js";
import welcomeRoutes from "./routes/WelcomeMail.js";
import EmployeeRoutes from "./routes/EmployeeRoutes.js";
import CompanyProfileRoutes from "./routes/CompanyProfileRoute.js";
import DocumentRoutes from "./routes/DocumentRoute.js";
import AgreementRoute from "./routes/AgreementRoute.js";
import DocumentMailRoute from "./routes/DocumentMailRoute.js";
import BroadcastRoutes from "./routes/BroadcastRoute.js";
import LeaveRoutes from "./routes/LeaveRoute.js";
import ChatRoutes from "./routes/ChatRoute.js"; // New Chat Route
import ChatUploadRoutes from "./routes/ChatUploadRoute.js"; // New Chat Upload Route
import ContactSalesRoute from "./routes/ContactSalesRoute.js"; // Inbound Sales Route

import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Real-time Chat imports
import { createServer } from "http";
import { Server } from "socket.io";
import { MessageModel } from "./models/MessageModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parseAllowedOrigins = () => {
  const envOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return ["http://localhost:3000", "http://localhost:5173", ...envOrigins];
};

const allowedOrigins = parseAllowedOrigins();

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
};

const app = express();
const server = createServer(app); // Wrap Express with HTTP Server

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (isOriginAllowed(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "user-role", "user-name"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use("/assets", express.static(path.join(__dirname, "../../CRM_FRONTEND/src/assets")));

app.use("/user", UserRoutes);
app.use("/booking", BookingRoutes);
app.use("/services", ServiceRoutes);
app.use("/mail", welcomeRoutes);
app.use("/employee", EmployeeRoutes);
app.use("/company", CompanyProfileRoutes);
app.use("/documents", DocumentRoutes);
app.use("/generate-agreement", AgreementRoute);
app.use("/document-mail", DocumentMailRoute);
app.use("/broadcasts", BroadcastRoutes);
app.use("/leaves", LeaveRoutes);
app.use("/chat", ChatRoutes);
app.use("/chat-upload", ChatUploadRoutes);
app.use("/sales", ContactSalesRoute);

// Keep track of connected users { userId: Set<socketId> }
global.onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("New client connected: " + socket.id);

  socket.on("join", (userId) => {
    if (userId) {
      if (!global.onlineUsers.has(userId)) {
        global.onlineUsers.set(userId, new Set());
      }
      global.onlineUsers.get(userId).add(socket.id);

      socket.join("global_chat"); // Everyone joins the global room
      socket.join(`user_${userId}`); // Join personal room for DMs

      // Broadcast to everyone that this user is online
      io.emit("user_online_status", { userId, isOnline: true });
    }
  });

  socket.on("sendMessage", async (data) => {
    try {
      const { sender_id, sender_name, receiver_id, is_global, message, attachment_url, attachment_type } = data;

      // Save to database
      const newMsg = await MessageModel.create({
        sender_id,
        sender_name,
        receiver_id: is_global ? null : receiver_id,
        is_global,
        message,
        attachment_url,
        attachment_type,
        read_by: [{ user_id: sender_id }]
      });

      if (is_global) {
        // Broadcast to "All Company"
        io.to("global_chat").emit("receiveMessage", newMsg);
      } else {
        // Send to specific user if online
        io.to(`user_${receiver_id}`).emit("receiveMessage", newMsg);
        // Send back to sender's other tabs too
        io.to(`user_${sender_id}`).emit("receiveMessage", newMsg);
      }
    } catch (e) {
      console.error("Socket send error:", e);
    }
  });

  socket.on("typing", (data) => {
    const { sender_id, sender_name, receiver_id, is_global, typing } = data;
    if (is_global) {
      socket.to("global_chat").emit("user_typing", { sender_id, sender_name, typing, is_global: true });
    } else {
      socket.to(`user_${receiver_id}`).emit("user_typing", { sender_id, sender_name, typing, is_global: false });
    }
  });

  socket.on("disconnect", () => {
    let disconnectedUserId = null;
    for (const [userId, socketIds] of global.onlineUsers.entries()) {
      if (socketIds.has(socket.id)) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          disconnectedUserId = userId;
          global.onlineUsers.delete(userId);
        }
        break;
      }
    }
    if (disconnectedUserId) {
      io.emit("user_online_status", { userId: disconnectedUserId, isOnline: false });
    }
    console.log("Client disconnected: " + socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("<h1>server is running successfully</h1>");
});

connection()
  .then(() => {
    console.log("connected to db");
    // VERY IMPORTANT: Use server.listen, not app.listen to start Socket.IO
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server (HTTP + WS) is running at http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });
