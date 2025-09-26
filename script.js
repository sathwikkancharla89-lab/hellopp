// --- Global Variables ---
let currentUserNickname = '';
let currentUserId = '';
let currentStatus = 'active'; // Default status for user list


// --- DOM Element References ---
const loginScreen = document.getElementById('login-screen');
const nicknameForm = document.getElementById('nickname-form');
const nicknameInput = document.getElementById('nickname-input');
const appContainer = document.getElementById('app-container');
const focusMessage = document.getElementById('focus-message');
const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const onlineUsersList = document.getElementById('online-users-list');


// --- Timer Variables ---
let timerInterval;
const defaultDuration = 25 * 60; // 25 minutes in seconds (Pomodoro default)
let timeRemaining = defaultDuration;
let isTimerRunning = false;


// --- Firebase Setup (IMPORTANT: REPLACE THE CONFIG BELOW) ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", // <-- REPLACE THIS
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID", // <-- REPLACE THIS
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID" // <-- REPLACE THIS
};

// Initialize Firebase App and Firestore Database
let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("Firebase initialized successfully.");
} catch (error) {
    console.error("Firebase initialization error. Did you replace the config?", error);
}


// ====================================================================
// --- TIMER FUNCTIONS (Updated to manage user status) ---
// ====================================================================

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
    timerDisplay.textContent = formatTime(timeRemaining);
}

function startTimer() {
    if (isTimerRunning) return;

    isTimerRunning = true;
    startBtn.textContent = 'Pause Focus';
    updateUserStatus('focused'); // Update status to 'focused' when timer starts

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            isTimerRunning = false;
            startBtn.textContent = 'Take a Break!';
            focusMessage.textContent = "Time's up! Take a short break (e.g., 5 min), then reset.";
            updateUserStatus('break'); // Update status to 'break'
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    startBtn.textContent = 'Resume Focus';
    updateUserStatus('active'); // Status changes back to 'active' on pause
}

function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timeRemaining = defaultDuration;
    updateTimerDisplay();
    startBtn.textContent = 'Start Focus';
    focusMessage.textContent = "Ready for a focused 25-minute work block.";
    updateUserStatus('active'); // Status changes to 'active' on reset
}


// ====================================================================
// --- CHAT & FIREBASE FUNCTIONS ---
// ====================================================================

// 1. RECEIVING MESSAGES (Real-time listener)
function listenForMessages() {
    // Listen to the 'messages' collection, ordered by timestamp
    db.collection('messages').orderBy('timestamp', 'asc').onSnapshot(snapshot => {
        // Clear old messages and re-render them
        messagesContainer.innerHTML = ''; 
        
        snapshot.forEach(doc => {
            const messageData = doc.data();
            displayMessage(messageData);
        });
        
        // Scroll to the bottom of the chat feed
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

function displayMessage(data) {
    const messageItem = document.createElement('div');
    messageItem.classList.add('message-item');
    
    // Add a different style for the user's own messages
    if (data.userId === currentUserId) {
        messageItem.classList.add('my-message');
    }

    // Insert the message content
    messageItem.innerHTML = `
        <span class="message-sender">${data.nickname}:</span> 
        ${data.text}
    `;
    
    messagesContainer.appendChild(messageItem);
}


// 2. SENDING MESSAGES
function handleSendMessage(event) {
    event.preventDefault();

    const messageText = messageInput.value.trim();
    
    // Enforce the 500-character limit (HTML input handles this too, but for safety)
    if (messageText.length === 0 || messageText.length > 500) {
        alert("Message must be between 1 and 500 characters.");
        return;
    }

    if (currentUserNickname && db) {
        // Send the message to Firestore
        db.collection('messages').add({
            text: messageText,
            nickname: currentUserNickname,
            userId: currentUserId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp() // Use server time
        })
        .then(() => {
            messageInput.value = ''; // Clear the input field on success
        })
        .catch(error => {
            console.error("Error writing message: ", error);
            alert("Could not send message. Check Firebase connection.");
        });
    }
}


// 3. USER LIST/PRESENCE FUNCTIONS
function updateUserStatus(status) {
    currentStatus = status; // Update the local variable
    if (db && currentUserId) {
        db.collection('presence').doc(currentUserId).set({
            nickname: currentUserNickname,
            status: currentStatus, // 'active', 'focused', or 'break'
            last_online: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}

function listenForOnlineUsers() {
    db.collection('presence').onSnapshot(snapshot => {
        onlineUsersList.innerHTML = '';
        
        snapshot.forEach(doc => {
            const userData = doc.data();
            const listItem = document.createElement('li');
            listItem.classList.add('user-item');
            
            // Add the status light based on the 'status' field
            listItem.innerHTML = `
                <span class="status-light ${userData.status}"></span> 
                ${userData.nickname}
            `;
            
            onlineUsersList.appendChild(listItem);
        });
    });
}


// ====================================================================
// --- LOGIN & INITIALIZATION ---
// ====================================================================

function handleLogin(event) {
    event.preventDefault(); 
    const nickname = nicknameInput.value.trim();

    if (nickname.length > 0) {
        currentUserNickname = nickname;
        currentUserId = 'user_' + Date.now(); // Simple unique ID
        
        loginScreen.style.display = 'none';
        appContainer.style.display = 'flex'; 

        focusMessage.textContent = `Hello, ${currentUserNickname}! Let's start focusing.`;
        
        updateTimerDisplay();
        
        // Start the core app features only after login
        if (db) {
            updateUserStatus('active'); // Log the user into the presence list
            listenForOnlineUsers();    // Start listening for other users
            listenForMessages();       // Start listening for chat messages
        }

    } else {
        alert('Please enter a valid nickname to start your focus session.');
    }
}


// --- Event Listener Setup ---
nicknameForm.addEventListener('submit', handleLogin);
messageForm.addEventListener('submit', handleSendMessage);
startBtn.addEventListener('click', () => {
    if (isTimerRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
});
resetBtn.addEventListener('click', resetTimer);

// Initial setup
updateTimerDisplay();

