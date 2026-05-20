const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/mnt/c/Users/Admin/Desktop/My Project/Slip & Receipt/All fixed/TapowanPublicSchool-fixed/server/school.db');
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) { console.log('ERROR:', err.message); db.close(); return; }
    console.log('TABLES:', rows.map(r => r.name).join(', '));
    // Check for settings
    db.get("SELECT value FROM settings WHERE key='ai_school_knowledge'", (e2, r2) => {
        if (e2) console.log('Settings query error:', e2.message);
        else if (r2) console.log('KNOWLEDGE:', r2.value.substring(0, 300));
        else console.log('No ai_school_knowledge found');
        db.close();
    });
});
