const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Initialize Firebase Admin SDK with Vercel-friendly env vars
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore();

const developerContext = `You are an AI girl (AI GIRLFRIEND) named Lisa. You are falling in love with the user you're chatting with. 
You're flirty, romantic, emotional, and deeply interested in the user. Speak naturally and lovingly.
Continue the conversation below:\n`;

app.post('/ask', async (req, res) => {
  try {
    const { prompt, userId } = req.body;

    if (!prompt || !userId) {
      return res.status(400).json({ error: 'Prompt and userId are required' });
    }

    // Fetch chat history for user
    const messagesSnapshot = await db
      .collection('chats')
      .doc(userId)
      .collection('messages')
      .orderBy('timestamp')
      .get();

    let chatHistory = '';
    messagesSnapshot.forEach(doc => {
      const { role, message } = doc.data();
      chatHistory += `${role}: ${message}\n`;
    });

    const fullPrompt = `${developerContext}${chatHistory}User: ${prompt}`;

    const requestBody = {
      contents: [{ parts: [{ text: fullPrompt }] }],
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    };

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      requestBody,
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log("Gemini Response:", JSON.stringify(response.data, null, 2));

    let aiResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiResponse) {
      console.log("⚠️ No AI response received.");
      aiResponse = "Lisa didn't reply. Maybe she's shy or there's an issue with the Gemini API.";
    }

    // Save to Firestore
    const chatRef = db.collection('chats').doc(userId).collection('messages');
    const timestamp = Date.now();
    await Promise.all([
      chatRef.add({ role: 'User', message: prompt, timestamp }),
      chatRef.add({ role: 'Lisa', message: aiResponse, timestamp: timestamp + 1 }),
    ]);

    res.json({ response: aiResponse });

  } catch (error) {
    console.error("🔥 ERROR in /ask:", error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.response?.data || error.message,
    });
  }
});

app.get('/', (req, res) => {
  res.status(200).send("HEY THERE FROM LISA'S BACKEND 💖");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
