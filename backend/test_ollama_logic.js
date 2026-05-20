const axios = require('axios');

const faqs = `
- What are the school timings?: The school timings are from 8 AM to 2 PM, Monday to Saturday.
- When are the summer holidays?: Summer holidays start from May 15th and end on June 30th.
- Is admission open?: Yes, admissions are open for the upcoming academic session. Please visit the school office.
- What is the fee structure?: For fee details, please visit the school office. I can only provide general info.
- Is transport available?: Yes, bus facility is available for most city routes.
`;

const systemPrompt = `You are a helpful, concise AI receptionist for Tapowan Public School. 
CRITICAL RULE: You MUST speak in Hindi by default. ONLY speak in English IF the user specifically speaks in English or asks you to speak in English.
Keep your responses strictly under 2 sentences. Never invent information. 
Use this context to answer:
${faqs}
If the user asks to speak to a human, or asks something not in the context, reply exactly with: "TRANSFER_TO_HUMAN".
If they say thank you or bye, say a polite goodbye.`;

require('dotenv').config();

async function testQuery(userText) {
    console.log(`\n🗣️ User: "${userText}"`);
    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'deepseek/deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userText }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`🤖 AI: "${response.data.choices[0].message.content.trim()}"`);
    } catch (err) {
        console.error(`❌ Error connecting to OpenRouter: (Error: ${err.response ? JSON.stringify(err.response.data) : err.message})`);
    }
}

async function runTests() {
    console.log("Starting AI Receptionist Logic Test...");
    await testQuery("What are the school timings?");
    await testQuery("Mujhe admission lena hai, is it open?");
    await testQuery("What is the fee for class 5?");
    await testQuery("Who is the principal of the school?"); // Should transfer to human
    await testQuery("I want to speak to the manager."); // Should transfer to human
    await testQuery("Okay thank you, bye.");
}

runTests();
