const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require("path");
const fs = require("fs");
const { writeFile, readFile } = fs;
const buffer = require("buffer");

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
});
app.get("/login", (req, res) => {
  // figure out how to include the params

  console.log(req.query.origin);

  // YOU MUST USE path TO JOIN PATH BREADCRUMBS
  res.sendFile(path.join(__dirname, "../public", "login.html"));
});

var userCount = 0;
var currentAnswer = "";
var answers = [];
var chosenPrompts = [];
var playersIndex = {};

function emitToSocket(srcSocket, name, value, value2) {
  io.to(srcSocket.id).emit(name, value, value2);
}

// MAKE IT SO THEY HAVE TO CHOOSE A USERNAME

io.on("connection", (socket) => {
  userCount += 1;

  console.log("a user connected:", userCount);

  socket.on("setIndexes", () => {
    if (!playersIndex[socket.id]) {
      playersIndex[socket.id] = {};
    }

    playersIndex[socket.id].index = 0;
  });

  socket.on("setUsername", (newUsername) => {
    playersIndex[toString(socket.id)].username = `${newUsername}`;
  });

  // CHECK PLAYER ANSWER
  socket.on("checkAnswer", (msg, playerName) => {
    console.log(msg);
    io.emit("loadMessage", msg, playerName);
  });

  socket.on("upload", (file) => {
    try {
      const char = "§";

      function getRandomMessage(list) {
        // console.log(list)

        const randomNumber = Math.round(Math.random() * list.length);
        // console.log(randomNumber)
        const randomItem = list[randomNumber];
        // console.log(randomItem)

        if (chosenPrompts.find((obj) => obj == randomItem)) {
          getRandomMessage(list);
        } else {
          chosenPrompts.push(randomItem);
        }
      }

      getRandomMessage(file);

      // load prompts
      chosenPrompts.forEach((msg) => {
        const author = msg.split(",")[msg.split(",").length - 1];

        console.log(author);
        answers.push(author);

        if (msg.includes(char)) {
          console.log("Message Contains Reference");
          io.emit("generated", msg, true);
        } else {
          io.emit("generated", msg);
        }
      });

      io.emit("setIndexes");
    } catch (error) {
      console.log(error);
      socket.emit("toast", "Please supply a working .json.");
      socket.emit("reset", null);
    }
  });

  const usersFile = "./users.caygrey";

  //code request token
  socket.on("requestToken", (username, password) => {
    const file = fs.readFileSync(usersFile, { encoding: "utf8" });
    if (file == undefined || file == "") {
      const buf = new Buffer.from("{}");
      fs.writeFileSync(usersFile, buf.toString("base64"), { encoding: "utf8" });
      return;
    }
    const users = JSON.parse(Buffer.from(file, "base64").toString("ascii"));
    if (users[username] == undefined) {
      // convert all file to from base then back to base
      // binary data should be performed using Buffer.from(str, 'base64') and buf.toString('base64').
      users[username] = password;
      var buf = new Buffer.from(JSON.stringify(users));
      fs.writeFileSync(usersFile, buf.toString("base64"), { encoding: "utf8" });
    } else if (password == users[username]) {
      const token =
        Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2);
      socket.emit("receiveToken", token);
    }
    console.log(users);
  });

  socket.on("disconnect", () => {
    userCount -= 1;

    console.log("user disconnected", userCount);
  });
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});
