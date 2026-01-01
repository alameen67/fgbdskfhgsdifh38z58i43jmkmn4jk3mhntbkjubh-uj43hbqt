// Hook Hub Key System API
const ADMIN_PASS = "hookcreed";
const STORAGE_KEY = "hookhub_keys";

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

// Load keys from memory or initialize
let keysDB = {};

// Initialize with a demo key
keysDB["HK-WNNWSVMQ"] = {
    key: "HK-WNNWSVMQ",
    duration: "1DAY",
    hwid: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + getDurationMs("1DAY"),
    paused: false,
    uses: 0
};

console.log("API Loaded with keys:", Object.keys(keysDB));

// Main API handler
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Handle GET request (for testing)
    if (req.method === 'GET') {
        return res.json({ 
            status: "Hook Hub API is running",
            message: "Use POST method for API calls",
            keysCount: Object.keys(keysDB).length,
            demoKey: "HK-WNNWSVMQ (1 Day)",
            endpoints: {
                POST: "/api/keys",
                actions: ["generate", "validate", "pause", "unpause", "resetHWID", "getAllKeys", "getKeyInfo"]
            }
        });
    }
    
    // Handle POST request
    if (req.method === 'POST') {
        try {
            let body;
            
            // Parse body based on how Vercel sends it
            if (req.body) {
                if (typeof req.body === 'string') {
                    body = JSON.parse(req.body);
                } else if (typeof req.body === 'object') {
                    body = req.body;
                } else {
                    return res.status(400).json({ error: "Invalid request body" });
                }
            } else {
                // Try to read from stream
                const chunks = [];
                for await (const chunk of req) {
                    chunks.push(chunk);
                }
                const rawBody = Buffer.concat(chunks).toString();
                body = JSON.parse(rawBody);
            }
            
            const { action, key, hwid, adminPass, duration, targetKey } = body;
            console.log(`[API Request] Action: ${action}, Key: ${key || targetKey || 'N/A'}`);
            
            // Validate required parameters
            if (!action) {
                return res.status(400).json({ error: "Action is required" });
            }
            
            const isAdmin = adminPass === ADMIN_PASS;
            
            switch (action) {
                case "validate":
                    if (!key) {
                        return res.json({ valid: false, reason: "No key provided" });
                    }
                    
                    const keyData = keysDB[key];
                    
                    if (!keyData) {
                        console.log(`[VALIDATE FAILED] Key not found: ${key}`);
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
                        console.log(`[VALIDATE SUCCESS] First use - Key: ${key}, HWID: ${hwid}`);
                        return res.json({ 
                            valid: true, 
                            duration: keyData.duration,
                            expiresAt: keyData.expiresAt
                        });
                    }
                    
                    // Check HWID match
                    if (keyData.hwid === hwid) {
                        keysDB[key].uses += 1;
                        console.log(`[VALIDATE SUCCESS] Key: ${key}, Uses: ${keysDB[key].uses}`);
                        return res.json({ 
                            valid: true, 
                            duration: keyData.duration,
                            expiresAt: keyData.expiresAt
                        });
                    }
                    
                    console.log(`[VALIDATE FAILED] HWID mismatch - Key: ${key}`);
                    return res.json({ valid: false, reason: "HWID mismatch" });
                    
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
                    
                    console.log(`[GENERATED] Key: ${newKey}, Duration: ${duration || "1DAY"}`);
                    return res.json({ success: true, key: newKey });
                    
                case "pause":
                    if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
                    if (!targetKey) return res.status(400).json({ error: "targetKey is required" });
                    
                    if (keysDB[targetKey]) {
                        keysDB[targetKey].paused = true;
                        console.log(`[PAUSED] Key: ${targetKey}`);
                        return res.json({ success: true });
                    }
                    return res.json({ success: false, error: "Key not found" });
                    
                case "unpause":
                    if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
                    if (!targetKey) return res.status(400).json({ error: "targetKey is required" });
                    
                    if (keysDB[targetKey]) {
                        keysDB[targetKey].paused = false;
                        console.log(`[UNPAUSED] Key: ${targetKey}`);
                        return res.json({ success: true });
                    }
                    return res.json({ success: false, error: "Key not found" });
                    
                case "resetHWID":
                    if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });
                    if (!targetKey) return res.status(400).json({ error: "targetKey is required" });
                    
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
                    if (!targetKey) return res.status(400).json({ error: "targetKey is required" });
                    
                    if (keysDB[targetKey]) {
                        return res.json({ success: true, key: keysDB[targetKey] });
                    }
                    return res.json({ success: false, error: "Key not found" });
                    
                case "health":
                    return res.json({ 
                        status: "healthy", 
                        keysCount: Object.keys(keysDB).length,
                        uptime: process.uptime()
                    });
                    
                default:
                    return res.status(400).json({ error: "Invalid action. Use: validate, generate, pause, unpause, resetHWID, getAllKeys, getKeyInfo" });
            }
            
        } catch (error) {
            console.error("[API ERROR]", error);
            return res.status(500).json({ 
                error: "Internal server error", 
                message: error.message,
                stack: error.stack 
            });
        }
    }
    
    // Method not allowed
    return res.status(405).json({ error: "Method not allowed. Use GET or POST." });
}
