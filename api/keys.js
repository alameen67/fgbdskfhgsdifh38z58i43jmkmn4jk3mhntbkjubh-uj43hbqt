// Simple in-memory database
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

// Add a test key
keysDB["HK-NC38KYHO"] = {
    key: "HK-NC38KYHO",
    duration: "1DAY",
    hwid: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + getDurationMs("1DAY"),
    paused: false,
    uses: 0
};

// Main API handler
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Handle GET request (for testing)
    if (req.method === 'GET') {
        return res.json({ 
            status: "API is running",
            keysCount: Object.keys(keysDB).length,
            endpoints: {
                POST: "/api/keys",
                actions: ["generate", "validate", "pause", "unpause", "resetHWID", "getAllKeys"]
            }
        });
    }
    
    // Handle POST request
    if (req.method === 'POST') {
        try {
            let body;
            if (typeof req.body === 'string') {
                body = JSON.parse(req.body);
            } else {
                body = req.body;
            }
            
            const { action, key, hwid, adminPass, duration, targetKey } = body;
            const isAdmin = adminPass === ADMIN_PASS;
            
            console.log(`[API] Action: ${action}, Key: ${key}`);
            
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
                    
                    console.log(`[GENERATED] Key: ${newKey}`);
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
                        return res.json({ valid: false, reason: "Key paused" });
                    }
                    
                    // Check if expired
                    if (Date.now() > keyData.expiresAt) {
                        return res.json({ valid: false, reason: "Key expired" });
                    }
                    
                    // First time use
                    if (!keyData.hwid) {
                        keysDB[key].hwid = hwid;
                        keysDB[key].uses = 1;
                        return res.json({ 
                            valid: true, 
                            duration: keyData.duration,
                            expiresAt: keyData.expiresAt
                        });
                    }
                    
                    // Check HWID match
                    if (keyData.hwid === hwid) {
                        keysDB[key].uses += 1;
                        return res.json({ 
                            valid: true, 
                            duration: keyData.duration,
                            expiresAt: keyData.expiresAt
                        });
                    }
                    
                    return res.json({ valid: false, reason: "HWID mismatch" });
                    
                case "pause":
                    if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
                    if (keysDB[targetKey]) {
                        keysDB[targetKey].paused = true;
                        return res.json({ success: true });
                    }
                    return res.json({ success: false, error: "Key not found" });
                    
                case "unpause":
                    if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
                    if (keysDB[targetKey]) {
                        keysDB[targetKey].paused = false;
                        return res.json({ success: true });
                    }
                    return res.json({ success: false, error: "Key not found" });
                    
                case "resetHWID":
                    if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
                    if (keysDB[targetKey]) {
                        keysDB[targetKey].hwid = null;
                        keysDB[targetKey].uses = 0;
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
            return res.status(500).json({ error: "Internal server error", details: error.message });
        }
    }
    
    // Method not allowed
    return res.status(405).json({ error: "Method not allowed. Use POST or GET." });
}
