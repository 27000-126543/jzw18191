import http from "http";
import app from "./app.js";
import { setupSocket } from "./socket.js";

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
setupSocket(server);

server.listen(PORT, () => {
  console.log(`Server + Socket.IO ready on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM signal received");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export default app;
