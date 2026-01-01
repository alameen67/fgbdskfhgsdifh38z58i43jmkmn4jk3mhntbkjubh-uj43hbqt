// Simple in-memory database (use a real DB for production)
let keysDB = {};

// Admin password
const ADMIN_PASS = "hookcreed";

// Helper functions
function generateKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "HK-";
    for (let i = 0; i < 8; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

function getDurationMs(duration) {
    const durations = {
        "1DAY": 24 * 60 * 60 * 1000,
        "1WEEK": 7 * 24 * 60 * 60 * 1000,
        "1MONTH": 30 * 24 * 60 * 60 * 1000
    };
    return durations[duration] || durations["1DAY"];
}

// Main API handler
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Only accept POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { action, key, hwid, adminPass, duration, targetKey } = req.body;
        const isAdmin = adminPass === ADMIN_PASS;
        
        switch (action) {
            case "generate":
                if (!isAdmin) {
                    return res.status(403).json({ error: "Unauthorized" });
                }
                
                const newKey = generateKey();
                const expiresAt = Date.now() + getDurationMs(duration || "1DAY");
                
                keysDB[newKey] = {
                    key: newKey,
                    duration: duration || "1DAY",
                    hwid: null,
                    createdAt: Date.now(),
                    expiresAt: expiresAt,
                    paused: false,
                    uses: 0
                };
                
                console.log(`[GENERATED] Key: ${newKey}, Duration: ${duration}`);
                return res.json({ success: true, key: newKey });
                
            case "validate":
                if (!key) {
                    return res.json({ valid: false, reason: "No key provided" });
                }
                
                const keyData = keysDB[key];
                
                if (!keyData) {
                    console.log(`[INVALID] Key not found: ${key}`);
                    return res.json({ valid: false, reason: "Invalid key" });
                }
                
                // Check if paused
                if (keyData.paused) {
                    console.log(`[PAUSED] Key: ${key}`);
                    return res.json({ valid: false, reason: "Key paused" });
                }
                
                // Check if expired
                if (Date.now() > keyData.expiresAt) {
                    console.log(`[EXPIRED] Key: ${key}`);
                    return res.json({ valid: false, reason: "Key expired" });
                }
                
                // First time use
                if (!keyData.hwid) {
                    keysDB[key].hwid = hwid;
                    keysDB[key].uses = 1;
                    console.log(`[FIRST USE] Key: ${key}, HWID: ${hwid}`);
                    return res.json({ 
                        valid: true, 
                        duration: keyData.duration,
                        expiresAt: keyData.expiresAt
                    });
                }
                
                // Check HWID match
                if (keyData.hwid === hwid) {
                    keysDB[key].uses += 1;
                    console.log(`[VALID] Key: ${key}, Uses: ${keysDB[key].uses}`);
                    return res.json({ 
                        valid: true, 
                        duration: keyData.duration,
                        expiresAt: keyData.expiresAt
                    });
                }
                
                console.log(`[HWID MISMATCH] Key: ${key}, Expected: ${keyData.hwid}, Got: ${hwid}`);
                return res.json({ valid: false, reason: "HWID mismatch" });
                
            case "pause":
                if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
                if (keysDB[targetKey]) {
                    keysDB[targetKey].paused = true;
                    console.log(`[PAUSED] Key: ${targetKey}`);
                    return res.json({ success: true });
                }
                return res.json({ success: false, error: "Key not found" });
                
            case "unpause":
                if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
                if (keysDB[targetKey]) {
                    keysDB[targetKey].paused = false;
                    console.log(`[UNPAUSED] Key: ${targetKey}`);
                    return res.json({ success: true });
                }
                return res.json({ success: false, error: "Key not found" });
                
            case "resetHWID":
                if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
                if (keysDB[targetKey]) {
                    keysDB[targetKey].hwid = null;
                    keysDB[targetKey].uses = 0;
                    console.log(`[HWID RESET] Key: ${targetKey}`);
                    return res.json({ success: true });
                }
                return res.json({ success: false, error: "Key not found" });
                
            case "getAllKeys":
                if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
                return res.json({ 
                    success: true, 
                    keys: keysDB,
                    count: Object.keys(keysDB).length 
                });
                
            case "getKeyInfo":
                if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
                if (keysDB[targetKey]) {
                    return res.json({ success: true, key: keysDB[targetKey] });
                }
                return res.json({ success: false, error: "Key not found" });
                
            default:
                return res.status(400).json({ error: "Invalid action" });
        }
    } catch (error) {
        console.error("[API ERROR]", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

// Add some demo keys for testing
keysDB["HK-DEMO123"] = {
    key: "HK-DEMO123",
    duration: "1WEEK",
    hwid: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + getDurationMs("1WEEK"),
    paused: false,
    uses: 0
};
