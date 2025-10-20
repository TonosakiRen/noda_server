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

// publicフォルダを静的配信
app.use(express.static(path.join(__dirname, "public")));

// index.html を返す
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

let players = {};
let gameStarted = false;

io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    socket.on("join", (name) => {
        players[socket.id] = { name, score: 0 };
        console.log(`👤 ${name} joined`);
    });

    socket.on("power", (count) => {
        if (!gameStarted) return;
        const player = players[socket.id];
        if (player) {
            player.score += count;
            io.emit("updatePower", getLeaderboard());
        }
    });

    socket.on("startGame", () => {
        gameStarted = true;
        console.log("🏁 Game started!");
        io.emit("gameStarted");
    });

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

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
});