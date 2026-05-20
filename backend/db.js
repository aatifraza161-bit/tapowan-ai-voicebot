require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase;

if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️ Warning: Missing Supabase URL or Anon Key in .env");
    console.warn("Falling back to dummy client (database calls will fail)");
    supabase = createClient('https://dummy.supabase.co', 'dummy');
} else {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("✅ Connected to Supabase");
}

async function getFaqs() {
    const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'ai_school_knowledge')
        .single();
    
    if (error || !data) {
        console.error("Supabase FAQ fetch error:", error?.message || "No data");
        return "No specific school rules provided. Tell the user to contact the office.";
    }
    return data.value;
}

async function logCall(callerId, transcript, transferred) {
    const { error } = await supabase
        .from('call_logs')
        .insert([
            { 
                caller_id: callerId, 
                transcript: transcript, 
                transferred_to_human: transferred ? true : false 
            }
        ]);
        
    if (error) {
        console.error("Failed to log call in Supabase:", error.message);
    }
}

module.exports = { supabase, getFaqs, logCall };
