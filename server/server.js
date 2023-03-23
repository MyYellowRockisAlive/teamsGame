const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
const { writeFile } = require('fs');

// https://expressjs.com/en/starter/static-files.html STILL MUST USE path (for some reason it requires absolute path)
app.use(express.static(path.join('../public')));
app.use(express.static(path.join('../images')));

app.get('/', (req, res) => {

    // YOU MUST USE path TO JOIN PATH BREADCRUMBS
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});
app.get('/faq', (req, res) => {

    // YOU MUST USE path TO JOIN PATH BREADCRUMBS
    res.sendFile(path.join(__dirname, '../public', 'faq.html'));
});
app.get('/media', (req, res) => {

    // figure out how to include the params

    console.log(req.query.src);
    console.log(req.query.origin);

    // YOU MUST USE path TO JOIN PATH BREADCRUMBS
    res.sendFile(path.join(__dirname, '../public', 'media.html'));



});

var userCount = 0;

function emitToSocket(srcSocket, name,value,value2) {
    io.to(srcSocket.id).emit(name,value,value2);
}

io.on('connection', (socket) => {
    
    userCount += 1;

    console.log('a user connected:',userCount);

    socket.on('checkAnswer', (msg) => {
        console.log('message: ' + msg);
        if(msg == 'hi'){
            socket.emit('answerStatus','Correct');
        }else{
            socket.emit('answerStatus','Wrong');
        };
    });

    socket.on("upload", (file) => {

        try {

            var chosenPrompts = [];
            const char = '§';
            
            function getRandomMessage(list) {

                // console.log(list)
                
                const randomNumber = Math.round(Math.random()*list.length)
                // console.log(randomNumber)
                const randomItem = list[randomNumber]
                // console.log(randomItem)

                if(chosenPrompts.find(obj => obj == randomItem)){
                    getRandomMessage(list)
                } else {
                    chosenPrompts.push(randomItem)
                };

            };
            
            getRandomMessage(file);

            chosenPrompts.forEach(msg => {

                if(msg.includes(char)){
                    emitToSocket(socket,'generated',msg,true);
                }else{
                    
                    console.log('no ref');

                    emitToSocket(socket,'generated',msg);

                }
                
            });

        } catch (error) {console.log(error); socket.emit("toast",'Please supply a working .json.'); socket.emit('reset',null);}

    })



    socket.on('disconnect', () => {

        userCount -= 1;

        console.log('user disconnected',userCount);
    });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});