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

// ✅ ランキング取得関数を修正
function getLeaderboard() {
  return Object.values(players)
    .filter(player => player.canBeOnStage) // ✅「はい」の人だけをフィルタリング
    .sort((a, b) => b.score - a.score) // スコア順にソート
    .slice(0, 10) // 上位10件に絞る
    .map(player => { 
      // C#側が受け取る形式にマッピングする
      return {
        name: player.displayName, 
        score: player.score
      };
    });
}

io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // ✅ "join" イベントの受信データを変更
    // (name, callback) から ({ name, canBeOnStage }, callback) に変更
    socket.on("join", ({ name, canBeOnStage }, callback) => {
        playerCounter++; // 🔹 接続順に番号を付ける
        const cleanName = name?.trim() || "名無し";
        const displayName = `野田軍${playerCounter}番隊隊長 ${cleanName}`; // ✅ 表示名を生成

        // ✅ playerオブジェクトに canBeOnStage を保存
        players[socket.id] = {
            name: cleanName,
            displayName,
            score: 0,
            unitNumber: playerCounter,
            canBeOnStage: canBeOnStage // 
        };

        // ✅ ログにも表示
        console.log(`👤 ${displayName} joined (Can be on stage: ${canBeOnStage})`);

        // getLeaderboard() が更新されたので、Unity/Web両方に正しい情報が送られる
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
            // console.log(`💥 ${player.displayName} +${count} → ${player.score}`); // ログが多すぎる場合はコメントアウト
            io.emit("updatePower", getTotalPower());
            
            // ✅ ランキング対象者（canBeOnStage: true）のみでリーダーボードを更新
            io.emit("updateLeaderboard", getLeaderboard());
        }
    });

    socket.on("startGame", () => {
        gameStarted = true;
        Object.values(players).forEach(p => p.score = 0);
        console.log("🏁 Game started!");
        io.emit("gameStarted");
        io.emit("updateLeaderboard", getLeaderboard()); // 念のためリセット
    });

    socket.on("endGame", () => {
        gameStarted = false;
        console.log("⏹️ Game ended!");
        
        // ✅ フィルタリングされた最終結果をUnityとWebクライアントに送信
        io.emit("gameEnded", getLeaderboard());
    });

    socket.on("disconnect", () => {
        if (players[socket.id]) {
            console.log(`❌ ${players[socket.id].displayName} disconnected`);
            delete players[socket.id];
            
            // ✅ フィルタリングされたリーダーボードを送信
            io.emit("updateLeaderboard", getLeaderboard());
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT} (Access: http://localhost:${PORT})`);
});