const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require("path");
const fs = require("fs");
const { writeFile } = fs;

// https://expressjs.com/en/starter/static-files.html STILL MUST USE path (for some reason it requires absolute path)
app.use(express.static(path.join("../public")));
app.use(express.static(path.join("../images")));

app.get("/", (req, res) => {
  // YOU MUST USE path TO JOIN PATH BREADCRUMBS
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});
app.get("/faq", (req, res) => {
  // YOU MUST USE path TO JOIN PATH BREADCRUMBS
  res.sendFile(path.join(__dirname, "../public", "faq.html"));
});
app.get("/media", (req, res) => {
  // figure out how to include the params

  console.log(req.query.src);
  console.log(req.query.origin);

  // YOU MUST USE path TO JOIN PATH BREADCRUMBS
  res.sendFile(path.join(__dirname, "../public", "media.html"));
  // res.render("index", { title: "Express" });
});
app.get("/login", (req, res) => {
  // figure out how to include the params

  console.log(req.query.origin);

  // YOU MUST USE path TO JOIN PATH BREADCRUMBS
  res.sendFile(path.join(__dirname, "../public", "login.html"));
});

var userCount = 0;
const char = "§";
var chosenPrompts = [];
const wantedPrompts = 10;
var users = {};
var game = false;
var gamemode = "turns";
var playerAnswers = {};

function emitToSocket(srcSocket, name, value, value2) {
  io.to(srcSocket.id).emit(name, value, value2);
}

io.on("connection", (socket) => {
  /**
                                                _                 _ _             
                                               | |               | (_)            
  _ __  _ __ ___  __ _  __ _ _ __ ___   ___    | | ___   __ _  __| |_ _ __   __ _ 
 | '_ \| '__/ _ \/ _` |/ _` | '_ ` _ \ / _ \   | |/ _ \ / _` |/ _` | | '_ \ / _` |
 | |_) | | |  __/ (_| | (_| | | | | | |  __/   | | (_) | (_| | (_| | | | | | (_| |
 | .__/|_|  \___|\__, |\__,_|_| |_| |_|\___|   |_|\___/ \__,_|\__,_|_|_| |_|\__, |
 | |              __/ |                                                      __/ |
 |_|             |___/                                                      |___/ 
   */
  userCount += 1;
  io.emit("playerCount", userCount);
  users[socket.id] ? null : (users[socket.id] = {});
  // LOAD THEM DEPENDING ON IF THE GAME IS IN PROGRESS OR NOT
  game
    ? ((users[socket.id]["playing"] = true), socket.emit("reset", true))
    : ((users[socket.id]["playing"] = false), socket.emit("reset"));
  userCount == 1
    ? ((users[socket.id]["host"] = true), socket.emit("reset"))
    : ((users[socket.id]["host"] = false), socket.emit("reset", true));
  // RESET PROMPT INDEX
  users[socket.id]["promptIndex"] = 0;
  // console.log(userCount, users);

  function sendMessage(index, fromIO) {
    const msg = chosenPrompts[index];
    // console.log(msg.message);
    if (fromIO == true) {
      if (msg.message.includes(char)) {
        io.emit("generated", msg.message, true);
      } else {
        io.emit("generated", msg.message);
      }
    } else {
      if (msg.message.includes(char)) {
        socket.emit("generated", msg.message, true);
      } else {
        socket.emit("generated", msg.message);
      }
    }
  }

  function checkToken(token) {
    var toReturn = undefined;
    if (token == undefined || token == null) {
      socket.emit("reset");
      return undefined;
    }

    const file = getUsersFile();

    for (var obj in file) {
      // console.log(obj);
      if (file[obj].token == token) {
        toReturn = obj;
      }
    }

    return toReturn;
  }
  const usersFile = "./.caydengrey";
  function getUsersFile() {
    const data = fs.readFileSync(usersFile, { encoding: "utf8" });
    if (data == undefined || data == "") {
      // admin is hardcoded and anyone can access
      const buf = new Buffer.from(
        `{ "admin": { "token": "", "password": "admin" } }`
      );
      fs.writeFileSync(usersFile, buf.toString("base64"), { encoding: "utf8" });
    }
    return JSON.parse(Buffer.from(data, "base64").toString("ascii"));
  }

  socket.on("getPlayerCount", () => {
    socket.emit("playerCount", userCount);
  });

  socket.on("checkAnswer", (msg, token) => {
    if (chosenPrompts.length == 0) {
      return;
    }

    msg = msg.toLowerCase();

    const checkWholePrompt = new Promise((resolve, reject) => {
      msg.split(" ").forEach((obj) => {
        for (let answers of chosenPrompts[
          users[socket.id]["promptIndex"]
        ].author
          .toLowerCase()
          .split(" ")) {
          if (obj == answers) {
            // console.log("found one");
            resolve(true);
            break;
          }
        }
        resolve(false);
      });
    });

    function checkCompleted() {
      for (var user of users) {
        if (user["promptIndex"] !== wantedPrompts) {
          return false;
        }
      }
      return true;
    }

    if (playerAnswers.length == users.length) {
      playerAnswers = {};
    }

    if (!playerAnswers[socket.id]) {
      playerAnswers[socket.id] = {};
    }

    playerAnswers[socket.id]["Answer"] = msg;

    if (gamemode == "turns") {
      if (users[socket.id]["promptIndex"] == chosenPrompts.length) {
        if (checkCompleted()) {
          var topPlayer;
          for (var player in users) {
            topPlayer ? null : (topPlayer = users[0]);
            if (player["Points"] > users[topPlayer]["Points"]) {
              topPlayer = player;
            }
          }
        }
      }

      for (let i = 1; i < users.length; i++) {
        console.log(users[i]["promptIndex"], users[i - 1]["promptIndex"]);
        if (users[i]["promptIndex"] == users[i - 1]["promptIndex"]) {
          // MOVE TO NEXT PROMPT
          sendMessage(users[socket.id]["promptIndex"], true);
          checkWholePrompt.then((fulfilled) => {
            for (var player of playerAnswers) {
              var msg = player["Answer"];
              if (
                msg ==
                  chosenPrompts[
                    users[socket.id]["promptIndex"]
                  ].author.toLowerCase() ||
                chosenPrompts[users[socket.id]["promptIndex"]].author
                  .toLowerCase()
                  .split(" ")
                  .find((obj) => obj == msg) ||
                fulfilled
              ) {
                io.sockets[player].emit("toast", "Incorrect");
              }
            }
          });
        }
      }
    }

    checkWholePrompt
      .then((fulfilled) => {
        // console.log(fulfilled);
        if (
          msg ==
            chosenPrompts[
              users[socket.id]["promptIndex"]
            ].author.toLowerCase() ||
          chosenPrompts[users[socket.id]["promptIndex"]].author
            .toLowerCase()
            .split(" ")
            .find((obj) => obj == msg) ||
          fulfilled
        ) {
          users[socket.id]["promptIndex"] += 1;
          if (gamemode == "race") {
            if (users[socket.id]["promptIndex"] == chosenPrompts.length) {
              console.log(checkToken(token));
              io.emit("winner", checkToken(token));
              return;
            }

            sendMessage(users[socket.id]["promptIndex"]);
            socket.emit("answerStatus", "Correct");
          }
        } else {
          socket.emit("answerStatus", "Wrong");
        }
      })
      .catch((err) => console.log("caught error", err));
  });

  socket.on("requestToken", (username, password) => {
    username = username.toLowerCase();
    username = username.replace(/\W+/gi, "");
    const users = getUsersFile();
    console.log("users file", users);
    if (users[username] == undefined) {
      // convert all file to from base then back to base
      // binary data should be performed using Buffer.from(str, 'base64') and buf.toString('base64').
      const token =
        Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2);
      users[username] = { token: token.toString(), password: password };
      var buf = new Buffer.from(JSON.stringify(users));
      fs.writeFileSync(usersFile, buf.toString("base64"), { encoding: "utf8" });
      socket.emit(
        "receiveToken",
        token,
        "Created new user. Sending you to your destination."
      );
    } else if (password == users[username]["password"]) {
      const token =
        Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2);
      users[username] = { token: token.toString(), password: password };
      var buf = new Buffer.from(JSON.stringify(users));
      fs.writeFileSync(usersFile, buf.toString("base64"), { encoding: "utf8" });
      socket.emit("receiveToken", token);
    }
    console.log(users);
  });

  socket.on("upload", (file) => {
    io.emit("reset", true);

    if (!game && users[socket.id]["host"] == true) {
      game = true;
    } else {
      io.emit("reset", true);
      return;
    }

    try {
      function getRandomMessage(list) {
        // console.log(list)

        const randomNumber = Math.round(Math.random() * list.length);
        // console.log(randomNumber)
        const randomItem = list[randomNumber];
        // console.log("randomItem", randomItem);
        const msgspl = randomItem.split(",");
        // for some god damned reason it takes -2 instead of -1 for splice????
        const message = msgspl.splice(-2, 1);
        // .join(",");
        // console.log(message);
        const author = randomItem.split(",").slice(-1);
        // console.log(message, author);

        if (chosenPrompts.length > 0) {
          for (let prompt of chosenPrompts) {
            if (prompt.message == message) {
              getRandomMessage(list);
            } else {
              chosenPrompts.push({ message: message[0], author: author[0] });
              break;
            }
          }
        } else {
          chosenPrompts.push({ message: message[0], author: author[0] });
        }

        // if (chosenPrompts.find((obj) => obj.message == randomItem)) {
        //   getRandomMessage(list);
        // } else {
        //   chosenPrompts.push(randomItem);
        // }
      }

      // MAKE A LOOP SO WE HAVE A COUPLE THING IN THE CHOSEN PROMPTS
      for (let i = 0; i < wantedPrompts; i++) {
        getRandomMessage(file);
      }

      console.log(chosenPrompts.length, chosenPrompts);

      sendMessage(0, true);
    } catch (err) {
      console.log("getRandomMessage", err);
      socket.emit("toast", "Please supply a working .json.");
      socket.emit("reset", null);
    }
  });

  socket.on("disconnect", () => {
    userCount -= 1;

    io.emit("playerCount", userCount);

    console.log("user disconnected", userCount);
  });
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});
