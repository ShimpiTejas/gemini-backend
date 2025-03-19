const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors'); // Import CORS

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors()); // Enable CORS

const developerContext = "You are an AI specialized in coding and software development. Answer questions concisely and technically.";

app.post('/ask', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const requestBody = {
            contents: [{ parts: [{ text: `${developerContext}\nUser: ${prompt}` }] }]
        };

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            requestBody,
            { headers: { 'Content-Type': 'application/json' } }
        );

        const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI";
        res.json({ response: aiResponse });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error', details: error.response?.data || error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
