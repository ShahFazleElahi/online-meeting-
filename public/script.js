const socket = io();

let localStream;
let peerConnections = {};

const videoContainer = document.getElementById('video-container');
const startCallButton = document.getElementById('start-call');
const joinCallButton = document.getElementById('join-call');

startCallButton.addEventListener('click', startCall);
joinCallButton.addEventListener('click', joinCall);

function startCall() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            displayStream(stream);
            const roomId = prompt('Enter Room ID to Start a Call:');
            socket.emit('joinRoom', { roomId });
            socket.on('userJoined', (userId) => {
                createPeerConnection(userId, roomId);
            });
        });
}

function joinCall() {
    const roomId = prompt('Enter Room ID to Join a Call:');
    socket.emit('joinRoom', { roomId });
    socket.on('userJoined', (userId) => {
        createPeerConnection(userId, roomId);
    });
}

function displayStream(stream) {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    videoContainer.appendChild(video);
}

function createPeerConnection(userId, roomId) {
    const peerConnection = new RTCPeerConnection();
    peerConnections[userId] = peerConnection;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('ice-candidate', { roomId, candidate: event.candidate });
        }
    };

    peerConnection.ontrack = event => {
        const video = document.createElement('video');
        video.srcObject = event.streams[0];
        video.autoplay = true;
        videoContainer.appendChild(video);
    };

    socket.on('offer', (offer) => {
        peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
            .then(() => peerConnection.createAnswer())
            .then(answer => peerConnection.setLocalDescription(answer))
            .then(() => {
                socket.emit('answer', { roomId, answer: peerConnection.localDescription });
            });
    });

    socket.on('answer', (answer) => {
        peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', (candidate) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit('offer', { roomId, offer: peerConnection.localDescription });
        });
}
