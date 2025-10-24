import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

let players = {};
let gameStarted = false;
let playerCounter = 0; // 🔹 番号用カウンター

function getTotalPower() {
    return Object.values(players).reduce((total, player) => total + player.score, 0);
}

function getLeaderboard() {
  return Object.values(players)
    .sort((a, b) => b.score - a.score) // スコア順にソート
    .slice(0, 10) // 上位10件に絞る
    .map(player => { // 
      // C#側が受け取る形式にマッピングする
      return {
        name: player.displayName, // 
        score: player.score
      };
    });
}

io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    socket.on("join", (name, callback) => {
        playerCounter++; // 🔹 接続順に番号を付ける
        const cleanName = name?.trim() || "名無し";
        const displayName = `野田軍${playerCounter}番隊隊長 ${cleanName}`; // ✅ 表示名を生成

        players[socket.id] = {
            name: cleanName,
            displayName,
            score: 0,
            unitNumber: playerCounter
        };

        console.log(`👤 ${displayName} joined`);

        io.emit("updateLeaderboard", getLeaderboard());

        if (callback) {
            // 🔹 クライアントへ送るデータを変更
            callback({
                isGameActive: gameStarted,
                displayName
            });
        }
    });

    socket.on("power", (count) => {
        const player = players[socket.id];
        if (gameStarted && player) {
            player.score += count;
            console.log(`💥 ${player.displayName} +${count} → ${player.score}`);
            io.emit("updatePower", getTotalPower());
            io.emit("updateLeaderboard", getLeaderboard());
        }
    });

    socket.on("startGame", () => {
        gameStarted = true;
        Object.values(players).forEach(p => p.score = 0);
        console.log("🏁 Game started!");
        io.emit("gameStarted");
    });

    socket.on("endGame", () => {
        gameStarted = false;
        console.log("⏹️ Game ended!");
        io.emit("gameEnded", getLeaderboard());
    });

    socket.on("disconnect", () => {
        if (players[socket.id]) {
            console.log(`❌ ${players[socket.id].displayName} disconnected`);
            delete players[socket.id];
            io.emit("updateLeaderboard", getLeaderboard());
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT} (Access: http://localhost:${PORT})`);
});