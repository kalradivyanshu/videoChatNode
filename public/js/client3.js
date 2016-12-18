function hasUserMedia(){
    return !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
}

if(hasUserMedia()) {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    navigator.getUserMedia({ video : true, audio : true}, function (stream) {
        var video = document.querySelector('video');
        //document.getElementById("error").innerHTML = "Success";
        window.stream = stream;
        video.src = window.URL.createObjectURL(stream);
    }, function (err) {
        document.getElementById("error").innerHTML = err.code+err.message+err;
        console.log("ERROR!", err)
    });
}
else {
    alert("WebRTC isn't supported");
}




var connection = new WebSocket("ws://"+window.location.hostname+":9090");
var name = "";

var loginInput = document.querySelector('#loginInput');
var loginBtn = document.querySelector('#loginBtn');

var otherUsernameInput = document.querySelector('#otherUsernameInput');
var connectToOtherUsernameBtn = document.querySelector('#connectToOtherUsernameBtn');
var msgInput = document.querySelector('#msgInput');
var sendMsgBtn = document.querySelector('#sendMsgBtn');
var connectedUser, myConnection, dataChannel;


var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');


//when a user clicks the login button
loginBtn.addEventListener("click", function(event) {
    name = loginInput.value;

    if(name.length > 0) {
        send({
            type: "login",
            name: name
        });
    }
});

//handle messages from the server
connection.onmessage = function (message) {
    console.log("Got message", message.data);
    var data = JSON.parse(message.data);

    switch(data.type) {
        case "login":
            onLogin(data.success);
            break;
        case "offer":
            onOffer(data.offer, data.name);
            break;
        case "answer":
            onAnswer(data.answer);
            break;
        case "candidate":
            onCandidate(data.candidate);
            break;
        default:
            break;
    }
};

//when a user logs in
function onLogin(success) {

    if (success === false) {
        alert("oops...try a different username");
    } else {
        //creating our RTCPeerConnection object
        var configuration = {
            "iceServers": [{ "url": "stun:stun.1.google.com:19302" }]
        };

        myConnection = new webkitRTCPeerConnection(configuration);

        console.log("RTCPeerConnection object was created");
        console.log(myConnection);

        myConnection.addStream(window.stream);
        myConnection.onaddstream = function (e) {
            remoteVideo.src = window.URL.createObjectURL(e.stream);
        };
        //setup ice handling
        //when the browser finds an ice candidate we send it to another peer
        myConnection.onicecandidate = function (event) {

            if (event.candidate) {
                send({
                    type: "candidate",
                    candidate: event.candidate
                });
            }
        };

        myConnection.ondatachannel = function(event) {
            var receiveChannel = event.channel;
            receiveChannel.onmessage = function(event) {
                console.log("ondatachannel message:", event.data);
            };
        };


        openDataChannel();

    }
};

connection.onopen = function () {
    console.log("Connected");
};

connection.onerror = function (err) {
    console.log("Got error", err);
};

// Alias for sending messages in JSON format
function send(message) {
    if (connectedUser) {
        message.name = connectedUser;
    }

    connection.send(JSON.stringify(message));
};

//setup a peer connection with another user
connectToOtherUsernameBtn.addEventListener("click", function () {

    var otherUsername = otherUsernameInput.value;
    connectedUser = otherUsername;

    if (otherUsername.length > 0) {
        //make an offer
        myConnection.createOffer(function (offer) {
            console.log();

            send({
                type: "offer",
                offer: offer
            });

            myConnection.setLocalDescription(offer);
        }, function (error) {
            alert("An error has occurred.");
        });
    }
});

//when somebody wants to call us
function onOffer(offer, name) {
    connectedUser = name;
    myConnection.setRemoteDescription(new RTCSessionDescription(offer));

    myConnection.createAnswer(function (answer) {
        myConnection.setLocalDescription(answer);

        send({
            type: "answer",
            answer: answer
        });

    }, function (error) {
        alert("oops...error");
    });
}

//when another user answers to our offer
function onAnswer(answer) {
    myConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

//when we got ice candidate from another user
function onCandidate(candidate) {
    myConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

//creating data channel
function openDataChannel() {

    var dataChannelOptions = {
        reliable:true
    };

    dataChannel = myConnection.createDataChannel("myDataChannel", dataChannelOptions);

    dataChannel.onerror = function (error) {
        console.log("Error:", error);
    };

    dataChannel.onmessage = function (event) {
        console.log("Got message:", event.data);
    };
}

//when a user clicks the send message button
sendMsgBtn.addEventListener("click", function (event) {
    console.log("send message");
    var val = msgInput.value;
    dataChannel.send(val);
});