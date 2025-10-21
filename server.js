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

function getTotalPower() {
    return Object.values(players).reduce((total, player) => total + player.score, 0);
}

function getLeaderboard() {
    return Object.values(players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
}


io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // --- ★★★ 修正箇所 ★★★ ---
    // 第2引数にコールバック関数 `callback` を追加
    socket.on("join", (name, callback) => {
        players[socket.id] = { name: name || "名無し", score: 0 };
        console.log(`👤 ${players[socket.id].name} joined`);
        
        io.emit("updateLeaderboard", getLeaderboard()); 
        
        // ★★★ 応答を返す処理を追加 ★★★
        // 参加してきたクライアントにだけ、現在のゲーム状態(true/false)を返す
        if (callback) {
            callback(gameStarted);
        }
    });

    socket.on("power", (count) => {
        const player = players[socket.id];
        if (gameStarted && player) {
            player.score += count;
            console.log(`💥 Received power from ${player.name}: ${count} (Total: ${player.score})`);
            
            io.emit("updatePower", getTotalPower());
            io.emit("updateLeaderboard", getLeaderboard());
        }
    });

    socket.on("startGame", () => {
        gameStarted = true;
        Object.values(players).forEach(p => p.score = 0);
        console.log("🏁 Game started!");
        io.emit("gameStarted");
        io.emit("updateLeaderboard", getLeaderboard());
    });

    socket.on("endGame", () => {
        gameStarted = false;
        console.log("⏹️ Game ended!");
        io.emit("gameEnded", getLeaderboard()); 
    });

    socket.on("disconnect", () => {
        if (players[socket.id]) {
            console.log(`❌ ${players[socket.id].name} disconnected`);
            delete players[socket.id];
            io.emit("updateLeaderboard", getLeaderboard());
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT} (Access: http://localhost:${PORT})`);
});