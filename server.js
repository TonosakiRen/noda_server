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

// ★★★ 追加 ★★★
// 全プレイヤーの合計スコアを計算する
function getTotalPower() {
    // プレイヤーオブジェクトの配列を取得し、各playerのscoreを合計する
    return Object.values(players).reduce((total, player) => total + player.score, 0);
}

// ランキング（上位10名）を取得する
function getLeaderboard() {
    return Object.values(players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
}


io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // スマホ（ブラウザ）から参加
    socket.on("join", (name) => {
        // ゲームが既に始まっている場合は参加させない（任意）
        // if (gameStarted) {
        //     socket.emit("gameAlreadyStarted");
        //     return;
        // }
        players[socket.id] = { name: name || "名無し", score: 0 };
        console.log(`👤 ${players[socket.id].name} joined`);
        // 現在のランキング（自分も含む）を更新して全員に送信
        io.emit("updateLeaderboard", getLeaderboard()); 
    });

    // スマホ（ブラウザ）から連打
    socket.on("power", (count) => {
        const player = players[socket.id];
        // ゲームが始まっていて、かつプレイヤーが存在する場合のみ処理
        if (gameStarted && player) {
            player.score += count;
            console.log(`💥 Received power from ${player.name}: ${count} (Total: ${player.score})`);
            
            // ★★★ 修正 ★★★
            // Unity（と全クライアント）に「合計値」を送信する
            io.emit("updatePower", getTotalPower());
            
            // スマホ（ブラウザ）側に「現在のランキング」を送信する
            io.emit("updateLeaderboard", getLeaderboard());
        }
    });

    // Unityからゲーム開始
    socket.on("startGame", () => {
        gameStarted = true;
        // 全プレイヤーのスコアをリセット
        Object.values(players).forEach(p => p.score = 0);
        console.log("🏁 Game started!");
        io.emit("gameStarted"); // 全員にゲーム開始を通知
        io.emit("updateLeaderboard", getLeaderboard()); // リセットされたランキングを送信
    });

    // Unityからゲーム終了
    socket.on("endGame", () => {
        gameStarted = false;
        console.log("⏹️ Game ended!");
        // 全員にゲーム終了と最終ランキングを通知
        io.emit("gameEnded", getLeaderboard()); 
    });

    // 接続切断
    socket.on("disconnect", () => {
        if (players[socket.id]) {
            console.log(`❌ ${players[socket.id].name} disconnected`);
            delete players[socket.id];
            // 誰かが抜けたらランキングを更新
            io.emit("updateLeaderboard", getLeaderboard());
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT} (Access: http://localhost:${PORT})`);
});