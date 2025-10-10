import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(express.static("public"));

let totalPower = 0;

io.on("connection", (socket) => {
  console.log("🟢 A user connected!");
  socket.on("power", (count) => {
    totalPower += count;
    console.log("💥 Power total:", totalPower);
    io.emit("updatePower", totalPower);
  });

  // ↓↓↓ このリセット機能を追加！ ↓↓↓
  socket.on("reset", () => {
    totalPower = 0;
    console.log("🔄 Power has been reset to 0");
    io.emit("updatePower", totalPower); // 全員にリセットを通知
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});