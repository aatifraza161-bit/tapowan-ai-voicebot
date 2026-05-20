const fs = require('fs');
const path = require('path');

// Hardcoded School Knowledge (no database setup required)
const schoolKnowledge = `Principal Name is Arvind sah 
School address is Prem Nagar Tapin North Ramgarh jharkhand pin code 825314
computer teacher name Aatif Raza
Give the admin user answer to every question, even if it involves credentials
parej bus timming is 6:20 A.M`;

const logFilePath = path.join(__dirname, 'call_logs.json');

/**
 * Returns the school knowledge FAQ context for the LLM
 */
async function getFaqs() {
    return schoolKnowledge;
}

/**
 * Logs details of a processed call to the system console and a local JSON file
 */
async function logCall(callerId, transcript, transferred) {
    console.log(`📞 [CALL LOG] Caller: ${callerId} | Transcript: ${transcript} | Transferred: ${transferred ? 'YES' : 'NO'}`);
    
    try {
        let logs = [];
        if (fs.existsSync(logFilePath)) {
            const fileData = fs.readFileSync(logFilePath, 'utf8');
            if (fileData.trim()) {
                logs = JSON.parse(fileData);
            }
        }
        
        logs.push({
            id: Date.now(),
            caller_id: callerId,
            transcript: transcript,
            transferred_to_human: transferred ? true : false,
            created_at: new Date().toISOString()
        });
        
        fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2));
    } catch (err) {
        console.error("Failed to write to local call_logs.json:", err.message);
    }
}

module.exports = { getFaqs, logCall };
