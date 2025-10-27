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
    .filter(player => player.canBeOnStage) // 「はい」の人だけをフィルタリング
    .sort((a, b) => b.score - a.score) // スコア順にソート
    .slice(0, 10) // 上位10件に絞る
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

        // ❌ Webクライアント向けのリアルタイムランキング更新も削除
        // io.emit("updateLeaderboard", getLeaderboard()); 

        if (callback) {
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
            
            // ❌ 以下の2行（ブロードキャスト）を削除
            // io.emit("updatePower", getTotalPower());
            // io.emit("updateLeaderboard", getLeaderboard());
        }
    });

    socket.on("startGame", () => {
        gameStarted = true;
        Object.values(players).forEach(p => p.score = 0);
        console.log("🏁 Game started!");
        io.emit("gameStarted");
        // ❌ スタート時のランキングブロードキャストも削除
        // io.emit("updateLeaderboard", getLeaderboard()); 
    });

    socket.on("endGame", () => {
        gameStarted = false;
        console.log("⏹️ Game ended!");
        
        // ✅ 最終結果は全員に送信する (合計クリック数もオブジェクトに含める)
        io.emit("gameEnded", {
            leaderboard: getLeaderboard(),
            totalPower: getTotalPower()
        });

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

    // ✅ Unityからのリアルタイムデータ（合計とランキング）リクエストに応答する
    socket.on("getGameData", (callback) => {
        // 現在の合計クリック数とランキングを計算
        const data = {
            totalPower: getTotalPower(),
            leaderboard: getLeaderboard()
        };
        // リクエストしてきたクライアント（Unity）にだけコールバックで返信
        if (callback) {
            callback(data);
        }
    });

    socket.on("disconnect", () => {
        if (players[socket.id]) {
            console.log(`❌ ${players[socket.id].displayName} disconnected`);
            delete players[socket.id];
            
            // ❌ 接続切断時のランキングブロードキャストも削除
            // io.emit("updateLeaderboard", getLeaderboard());
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT} (Access: http://localhost:${PORT})`);
});