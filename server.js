import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

let players = {};
let gameStarted = false;

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // 名前を登録
  socket.on("join", (name) => {
    players[socket.id] = { name, score: 0 };
    console.log(`👤 ${name} joined`);
  });

  // 連打イベント
  socket.on("power", (count) => {
    if (!gameStarted) return; // 開始していなければ無効
    const player = players[socket.id];
    if (player) {
      player.score += count;
      io.emit("updatePower", getLeaderboard());
    }
  });

  // Unity側が「開始」ボタンを押した
  socket.on("startGame", () => {
    gameStarted = true;
    console.log("🏁 Game started!");
    io.emit("gameStarted");
  });

  // Unity側が「終了」ボタンを押した（ボス撃破）
  socket.on("endGame", () => {
    gameStarted = false;
    console.log("⏹️ Game ended!");
    io.emit("gameEnded", getLeaderboard());
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

function getLeaderboard() {
  return Object.values(players)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

httpServer.listen(3000, "0.0.0.0", () => {
  console.log("✅ Server running on port 3000");
});