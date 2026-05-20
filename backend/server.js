require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getFaqs, logCall } = require('./db');

const app = express();
const cors = require('cors');
app.use(cors()); // Allow simulator to fetch from this backend
app.use(express.json());

// Endpoint for Web Simulator to fetch real Vidya AI data
app.get('/api/vidya-knowledge', async (req, res) => {
    try {
        const knowledge = await getFaqs();
        res.send(knowledge);
    } catch(err) {
        res.status(500).send("Error reading DB");
    }
});

// Serve the simulator UI on the root port
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web_simulator.html'));
});

// Endpoint for Web Simulator to generate response without TTS
app.post('/api/simulate', async (req, res) => {
    try {
        const text = req.body.text;
        const aiResponseText = await generateResponse(text);
        res.json({ response: aiResponseText });
    } catch (e) {
        res.status(500).json({ response: "Error generating response" });
    }
});

// Setup Multer for receiving audio files from Asterisk
const upload = multer({ dest: 'uploads/' });

// STT: Whisper (Local CPU via whisper.cpp)
async function transcribeAudio(audioPath) {
    return new Promise((resolve, reject) => {
        // whisper.cpp compiled binary + multilingual small model for Hindi
        const whisperCmd = `/opt/whisper.cpp/main -m /opt/whisper.cpp/models/ggml-small.bin -f ${audioPath} -nt -l auto`;
        exec(whisperCmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Whisper Error: ${error.message}`);
                resolve(""); // Return empty on error
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

// LLM: OpenRouter AI
async function generateResponse(transcript) {
    const faqContext = await getFaqs();

    const systemPrompt = `You are a strict AI receptionist for Tapowan Public School.
CRITICAL RULES:
1. Speak in Hindi by default. ONLY speak in English IF the user speaks English.
2. STRICT KNOWLEDGE: You can ONLY use the "School Info" provided below.
3. NO HALLUCINATION: If the user asks about ANY detail (timing, bus, fee, person) NOT explicitly written in the School Info, you MUST reply with: "Mujhe iski jankari nahi hai. Kripya school office se sampark karein." (or English equivalent). DO NOT GUESS.
4. Keep responses under 2 sentences.
5. If the user asks to speak to a human, reply EXACTLY with: "TRANSFER_TO_HUMAN".

School Info:
${faqContext}`;

    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'deepseek/deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: transcript }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data.choices[0].message.content.trim();
    } catch (err) {
        console.error("OpenRouter Error:", err.response ? err.response.data : err.message);
        return "Sorry, I am facing a technical issue. Please contact the office.";
    }
}

// TTS: Piper (Local CPU)
async function textToSpeech(text, outputPath) {
    return new Promise((resolve, reject) => {
        // Assuming piper is installed at /opt/piper
        // Using a fast voice model e.g., en_US-lessac-medium
        const safeText = text.replace(/"/g, '\\"').replace(/\n/g, ' ');
        const piperCmd = `echo "${safeText}" | /opt/piper/piper --model /opt/piper/voices/en_US-lessac-medium.onnx --output_file ${outputPath}`;
        
        exec(piperCmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Piper Error: ${error.message}`);
                resolve(false);
            } else {
                // Asterisk needs 8kHz or 16kHz wav. We can use ffmpeg if needed, but assuming piper outputs compatible wav
                resolve(true);
            }
        });
    });
}

app.post('/api/voice-process', upload.single('audio'), async (req, res) => {
    // Keeping existing HTTP endpoint for backward compatibility with Asterisk
    const callerId = req.body.callerId || "Unknown";
    const audioFile = req.file;
    if (!audioFile) return res.status(400).send("No audio uploaded");

    try {
        const transcript = await transcribeAudio(audioFile.path);
        console.log(`[Caller ${callerId}] Transcript: ${transcript}`);
        if (!transcript || transcript.length < 2) return res.json({ action: 'playback', text: 'I did not hear anything. Please try again.', file: '' });

        const aiResponseText = await generateResponse(transcript);
        console.log(`[AI Response]: ${aiResponseText}`);

        if (aiResponseText.includes("TRANSFER_TO_HUMAN")) {
            logCall(callerId, transcript, true);
            return res.json({ action: 'transfer', extension: '100' });
        }
        logCall(callerId, `User: ${transcript}\nAI: ${aiResponseText}`, false);

        const responseWavName = `response_${Date.now()}.wav`;
        const responsePath = path.join(__dirname, 'uploads', responseWavName);
        const ttsSuccess = await textToSpeech(aiResponseText, responsePath);
        
        if (ttsSuccess) {
            res.download(responsePath, () => {
                fs.unlink(audioFile.path, () => {});
                fs.unlink(responsePath, () => {});
            });
        } else {
            res.status(500).send("TTS Failed");
        }
    } catch (error) {
        console.error("Pipeline Error:", error);
        res.status(500).send("Internal Server Error");
    }
});

const http = require('http');
const WebSocket = require('ws');
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/stream' });

function getRMS(base64Str) {
    const buffer = Buffer.from(base64Str, 'base64');
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i += 2) {
        const sample = buffer.readInt16LE(i);
        sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / (buffer.length / 2)) || 0;
}

wss.on('connection', (ws) => {
    console.log('Exotel WebSocket connected on /stream');
    let audioBuffer = [];
    let silencePackets = 0;
    let isProcessing = false;
    let callId = "WS_" + Date.now();

    ws.on('message', async (message) => {
        if (isProcessing) return; // Ignore audio while AI is thinking

        try {
            const data = JSON.parse(message);
            if (data.event === 'media' && data.media && data.media.payload) {
                const payload = data.media.payload;
                audioBuffer.push(payload);
                
                const rms = getRMS(payload);
                if (rms < 300) { // Silence threshold
                    silencePackets++;
                } else {
                    silencePackets = 0;
                }

                // If silent for ~50 packets (approx 1 second depending on packet size) and we have audio
                if (silencePackets > 50 && audioBuffer.length > 50) {
                    isProcessing = true;
                    console.log(`[${callId}] Silence detected, processing audio...`);
                    
                    const pcmBuffer = Buffer.concat(audioBuffer.map(b => Buffer.from(b, 'base64')));
                    audioBuffer = []; // Clear buffer
                    silencePackets = 0;

                    // Write PCM to a temp file. Note: whisper.cpp expects WAV, so we'd normally add a WAV header.
                    // For a robust system, use ffmpeg or write a raw PCM -> WAV header function.
                    const tempRawPath = path.join(__dirname, 'uploads', `${callId}.raw`);
                    fs.writeFileSync(tempRawPath, pcmBuffer);
                    
                    // Convert raw to wav for whisper
                    const tempWavPath = path.join(__dirname, 'uploads', `${callId}.wav`);
                    // Using ffmpeg to add wav header (assuming ffmpeg is available)
                    exec(`ffmpeg -y -f s16le -ar 8000 -ac 1 -i ${tempRawPath} ${tempWavPath}`, async (err) => {
                        if(!err) {
                            const transcript = await transcribeAudio(tempWavPath);
                            console.log(`[${callId}] User: ${transcript}`);
                            
                            if (transcript.length > 2) {
                                const aiResponseText = await generateResponse(transcript);
                                console.log(`[${callId}] AI: ${aiResponseText}`);
                                logCall(callId, `User: ${transcript}\nAI: ${aiResponseText}`, false);

                                const responseWavPath = path.join(__dirname, 'uploads', `${callId}_resp.wav`);
                                const ttsSuccess = await textToSpeech(aiResponseText, responseWavPath);
                                
                                if (ttsSuccess) {
                                    // Send back to Exotel
                                    const outBuffer = fs.readFileSync(responseWavPath);
                                    // Strip 44 byte WAV header to send raw PCM
                                    const pcmOut = outBuffer.slice(44);
                                    ws.send(JSON.stringify({
                                        event: "media",
                                        media: { payload: pcmOut.toString('base64') }
                                    }));
                                }
                            }
                        }
                        isProcessing = false;
                    });
                }
            }
        } catch (e) {
            console.error("WS Message Error:", e.message);
        }
    });

    ws.on('close', () => {
        console.log('Exotel WebSocket disconnected');
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Tapowan Voice AI Backend (HTTP & WS) running on port ${PORT}`);
});
