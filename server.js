const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { compileFunction } = require("vm");
const sqlite3 = require("sqlite3").verbose();

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use("/images", express.static("images"));

const db = new sqlite3.Database("./tamagotchi.db", (err) => {
  if (err) console.error(err.message);
  console.log("Connected to the SQLite database.");
});

// 初期データ
const initialState = {
  hunger: 50,
  cleanliness: 50,
  comfort: 50,
  happiness: 50,
};

// データベースの初期化
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS tamagotchi (id INTEGER PRIMARY KEY, hunger INTEGER, cleanliness INTEGER, comfort INTEGER, happiness INTEGER)`
  );
  db.get("SELECT * FROM tamagotchi WHERE id = 1", (err, row) => {
    if (!row) {
      const { hunger, cleanliness, comfort, happiness } = initialState;
      db.run(
        `INSERT INTO tamagotchi (id, hunger, cleanliness, comfort, happiness) VALUES (1, ?, ?, ?, ?)`,
        [hunger, cleanliness, comfort, happiness]
      );
    }
  });
});

// 静的ファイルを提供
app.use(express.static("public"));

// 画像フォルダを提供する
app.use("/images", express.static("images"));

// 状態を時間経過で変化させる関数
function decreaseState() {
  db.get("SELECT * FROM tamagotchi WHERE id = 1", (err, row) => {
    if (row) {
      let { hunger, cleanliness, comfort, happiness } = row;

      // 時間経過で状態を変化
      hunger = Math.max(hunger - 5, 0); //
      cleanliness = Math.max(cleanliness - 3, 0);
      comfort = Math.max(comfort - 1, 0); //
      happiness = Math.max(happiness - 2, 0); //

      // 更新されたデータを保存
      db.run(
        `UPDATE tamagotchi SET hunger = ?, cleanliness = ?, comfort = ?, happiness=? WHERE id = 1`,
        [hunger, cleanliness, comfort, happiness],
        () => {
          io.emit("updateState", { hunger, cleanliness, comfort, happiness }); // クライアントに状態を通知
        }
      );
    }
  });
}

// 一定間隔で状態を更新 (10秒ごと)
setInterval(decreaseState, 10000);

// Socket.IOの通信
io.on("connection", (socket) => {
  console.log("A user connected");

  // 初期データを送信
  db.get("SELECT * FROM tamagotchi WHERE id = 1", (err, row) => {
    if (row) {
      socket.emit("updateState", row);
    }
  });

  // 進捗度の合計値をサーバーで管理 (初期値は0)
  let progressTotal = 0;
  let toiletTotal = 0;
  // アクションを処理
  socket.on("action", (data) => {
    const { action, value } = data;
    console.log(`Received action: ${action} with value: ${value}`); // ログを追加

    db.get("SELECT * FROM tamagotchi WHERE id = 1", (err, row) => {
      if (row) {
        let { hunger, cleanliness, comfort, happiness } = row;

        // 進捗度（feed）の場合
        if (action === "feed") {
          // 進捗の合計を更新
          progressTotal += value;
          // 進捗度の合計が3000を超えた場合、hungerを100に設定
          if (progressTotal >= 3000) {
            hunger = 100;
            console.log("Progress total reached 3000. Hunger set to 100.");
          }
        }
        socket.emit("progressUpdate", progressTotal);
        // 他のアクション
        if (action === "bath") {
          if (value >= 15) {
            // 条件が満たされた場合
            cleanliness = 100;
            console.log("Sufficient participants. Cleanliness set to 100.");
          }
        }

        if (action === "toilet") {
          toiletTotal += value; // トイレ合計人数を更新
          io.emit("toiletProgressUpdate", toiletTotal); // クライアントに現在の合計を通知
          while (toiletTotal >= 19) {
            toiletTotal -= 19; // 19を引いて新しいカウントを開始
            comfort = 100; // 快適度を最大に設定
            console.log("Toilet total reached 19. Comfort set to 100.");
          }
        }
        // playアクション
        if (action === "play") {
          happiness = 100; // 幸福度を最大に設定
          console.log("Play action triggered. Happiness set to 100.");
        }

        // 更新したデータを保存
        db.run(
          `UPDATE tamagotchi SET hunger = ?, cleanliness = ?, comfort = ?, happiness = ? WHERE id = 1`,
          [hunger, cleanliness, comfort, happiness],
          () => {
            io.emit("updateState", { hunger, cleanliness, comfort, happiness }); // 全員に更新を通知
          }
        );
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// サーバーを起動

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://${getLocalIPAddress()}:${PORT}/`);
});

// ローカルIPを取得する関数
function getLocalIPAddress() {
  const { networkInterfaces } = require("os");
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
}
