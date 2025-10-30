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
let playerCounter = 0;
let isTappingAllowed = false; // ✅ タップ許可状態 (最初は false)

function getTotalPower() {
    return Object.values(players).reduce((total, player) => total + player.score, 0);
}

function getLeaderboard() {
  return Object.values(players)
    .filter(player => player.canBeOnStage)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(player => {
      return {
        name: player.displayName,
        score: player.score
      };
    });
}

io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    socket.on("join", ({ name, canBeOnStage }, callback) => {
        playerCounter++;
        const cleanName = name?.trim() || "名無し";
        const displayName = `野田軍${playerCounter}番隊隊長 ${cleanName}`;

        players[socket.id] = {
            name: cleanName,
            displayName,
            score: 0,
            unitNumber: playerCounter,
            canBeOnStage: canBeOnStage
        };

        console.log(`👤 ${displayName} joined (Can be on stage: ${canBeOnStage})`);

        if (callback) {
            callback({
                isGameActive: gameStarted,
                displayName,
                isTappingAllowed: isTappingAllowed // ✅ 現在の状態を返す
            });
            // ✅ ログ追加
            console.log(`[Join Callback] Sent current state: isGameActive=${gameStarted}, isTappingAllowed=${isTappingAllowed}`);
        }
    });

    socket.on("power", (count) => {
        const player = players[socket.id];
         // ✅ ログ追加
        console.log(`[Power Received] gameStarted=${gameStarted}, isTappingAllowed=${isTappingAllowed}`);
        if (gameStarted && isTappingAllowed && player) {
            player.score += count;
            console.log(`[Power Accepted] ${player.displayName} added ${count}. New score: ${player.score}`);
        } else {
             console.log(`[Power Rejected] Click from ${player?.displayName} ignored.`);
        }
    });

    socket.on("startGame", () => {
        gameStarted = true;
        isTappingAllowed = false; // ✅ ゲーム開始時は必ずタップ禁止から
        Object.values(players).forEach(p => p.score = 0);
        // ✅ ログ追加
        console.log("🏁 Game started! Setting isTappingAllowed = false");
        io.emit("gameStarted");
        io.emit("tappingDisallowed"); // ✅ 開始時は禁止状態を通知
    });

    socket.on("endGame", () => {
        gameStarted = false;
        isTappingAllowed = false; // ✅ ゲーム終了時もタップ禁止に
        // ✅ ログ追加
        console.log("⏹️ Game ended! Setting isTappingAllowed = false");

        io.emit("gameEnded", {
            leaderboard: getLeaderboard(),
            totalPower: getTotalPower()
        });
        io.emit("tappingDisallowed"); // ✅ 終了時も禁止状態を通知

        console.log("--- プレイヤーデータとカウンターをリセットします ---");
        players = {};
        playerCounter = 0;
    });

    socket.on("getConnectionCount", (callback) => {
        const count = Object.keys(players).length;
        console.log(`📡 接続数のリクエスト受信。現在の接続数: ${count}`);
        if (callback) {
            callback(count);
        }
    });

    socket.on("getGameData", (callback) => {
        const data = {
            totalPower: getTotalPower(),
            leaderboard: getLeaderboard()
        };
        if (callback) {
            callback(data);
        }
    });

    // --- ✅ Unityからのタップ制御 ---
    socket.on("allowTapping", () => {
        // ✅ ログ追加
        console.log("[allowTapping Received]");
        if(gameStarted) { // ゲーム中のみ許可
            isTappingAllowed = true;
            console.log("✅ Tapping allowed by Unity. Setting isTappingAllowed = true");
            io.emit("tappingAllowed"); // ✅ Webクライアントに通知
        } else {
            console.log("⚠️ allowTapping received but game not started. Ignored.");
        }
    });

    socket.on("disallowTapping", () => {
        // ✅ ログ追加
        console.log("[disallowTapping Received]");
        isTappingAllowed = false; // ゲーム中かどうかに関わらず禁止はできるようにする
        console.log("🚫 Tapping disallowed by Unity. Setting isTappingAllowed = false");
        io.emit("tappingDisallowed"); // ✅ Webクライアントに通知
    });
    // --- ここまで ---

    socket.on("disconnect", () => {
        if (players[socket.id]) {
            console.log(`❌ ${players[socket.id].displayName} disconnected`);
            delete players[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT} (Access: http://localhost:${PORT})`);
});