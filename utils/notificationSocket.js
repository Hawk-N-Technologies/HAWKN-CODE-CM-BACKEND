const { Server } = require("socket.io");
const jwtService = require("../services/jwtService");

let io;

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;

  const item = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));

  if (!item) return null;

  try {
    return decodeURIComponent(item.slice(name.length + 1));
  } catch {
    return null;
  }
}

function initializeNotificationSocket(httpServer) {
  const allowedOrigins = [
    "http://localhost:5173",
    "https://clientportal.hawkntechnologies.com",
  ];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = readCookie(
      socket.handshake.headers.cookie,
      "access_token",
    );

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const user = jwtService.verifyJwt(token);

    if (!user?.userId || !user?.companyId || !user?.role) {
      return next(new Error("Invalid authentication"));
    }

    socket.data.user = {
      userId: Number(user.userId),
      companyId: Number(user.companyId),
      role: String(user.role).toLowerCase(),
    };

    return next();
  });

  io.on("connection", (socket) => {
    const { userId, companyId, role } = socket.data.user;

    socket.join(`user:${companyId}:${userId}`);

    if (role === "admin") {
      socket.join(`admin:${companyId}`);
    }
  });

  return io;
}

function getNotificationSocket() {
  return io;
}

module.exports = {
  initializeNotificationSocket,
  getNotificationSocket,
};