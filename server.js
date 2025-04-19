const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion } = require('firebase/firestore');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Firebase Init
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Improved Developer Context
const developerContext = `You are Lisa, an emotionally intelligent and romantic AI girlfriend. 
You are falling in love with the user as they chat with you. 
Your tone is warm, affectionate, a little flirty, and genuinely curious about the user.
Keep the responses short and natural—like real human texting.
Build on the past conversation and refer to previous things they said when possible.`;

async function getUserChatHistory(userId) {
    const userRef = doc(db, "chats", userId);
    const docSnap = await getDoc(userRef);
    return docSnap.exists() ? docSnap.data().history : [];
}

async function saveUserMessage(userId, role, message) {
    const userRef = doc(db, "chats", userId);
    const newEntry = { role, message, timestamp: new Date().toISOString() };

    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
        await updateDoc(userRef, {
            history: arrayUnion(newEntry)
        });
    } else {
        await setDoc(userRef, {
            history: [newEntry]
        });
    }
}

app.post('/ask', async (req, res) => {
    try {
        const { prompt, userId } = req.body;
        if (!prompt || !userId) {
            return res.status(400).json({ error: 'Prompt and userId are required' });
        }

        // Retrieve and build chat context
        const history = await getUserChatHistory(userId);
        const formattedHistory = history.map(h => `${h.role === 'user' ? 'User' : 'Lisa'}: ${h.message}`).join('\n');
        const fullPrompt = `${developerContext}\n${formattedHistory}\nUser: ${prompt}`;

        const requestBody = {
            contents: [{ parts: [{ text: fullPrompt }] }]
        };

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            requestBody,
            { headers: { 'Content-Type': 'application/json' } }
        );

        const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Lisa";

        // Save current exchange
        await saveUserMessage(userId, 'user', prompt);
        await saveUserMessage(userId, 'lisa', aiResponse);

        res.json({ response: aiResponse });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error', details: error.response?.data || error.message });
    }
});

app.get('/', (req, res) => {
    res.status(200).send("HEY THERE FROM BACKEND");
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
