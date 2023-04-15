const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require("path");
const { writeFile } = require("fs");

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

var userCount = 0;
const char = "§";
var chosenPrompts = [];
const wantedPrompts = 10;
var users = {};
var game = false;

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
  users[socket.id] ? null : (users[socket.id] = {});
  // LOAD THEM DEPENDING ON IF THE GAME IS IN PROGRESS OR NOT
  game
    ? ((users[socket.id]["playing"] = true), socket.emit("reset", true))
    : ((users[socket.id]["playing"] = false), socket.emit("reset"));
  // RESET PROMPT INDEX
  users[socket.id]["promptIndex"] = 0;
  // console.log(userCount, users);

  function sendMessage(index) {
    const msg = chosenPrompts[index];
    // console.log(msg.message);
    if (msg.message.includes(char)) {
      emitToSocket(socket, "generated", msg.message, true);
    } else {
      emitToSocket(socket, "generated", msg.message);
    }
  }

  socket.on("checkAnswer", (msg) => {
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

    // console.log("message: " + msg, users[socket.id]["promptIndex"]);
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
          // MAKE A WAY TO CHECK IF SOMEBODY WON HERE
          users[socket.id]["promptIndex"] += 1;

          // console.log(users[socket.id]["promptIndex"], chosenPrompts.length);

          if (users[socket.id]["promptIndex"] == chosenPrompts.length) {
            io.emit("winner", socket.id);
            return;
          }

          sendMessage(users[socket.id]["promptIndex"]);
          socket.emit("answerStatus", "Correct");
        } else {
          socket.emit("answerStatus", "Wrong");
        }
      })
      .catch((err) => console.log("caught error", err));
  });

  socket.on("upload", (file) => {
    socket.emit("reset", true);

    if (!game) {
      game = true;
    } else {
      socket.emit("reset", true);
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

      sendMessage(0);
    } catch (err) {
      console.log("getRandomMessage", err);
      socket.emit("toast", "Please supply a working .json.");
      socket.emit("reset", null);
    }
  });

  socket.on("disconnect", () => {
    userCount -= 1;

    console.log("user disconnected", userCount);
  });
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});
