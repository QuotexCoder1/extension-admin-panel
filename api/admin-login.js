export default async function handler(req, res) {
    // ================================
    // CORS
    // ================================
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            error: "Method not allowed"
        });
    }

    // ================================
    // ADMIN PASSWORD
    // ================================
    const adminPassword =
        process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        return res.status(500).json({
            success: false,
            error: "ADMIN_PASSWORD is not configured"
        });
    }

    // ================================
    // REQUEST
    // ================================
    const body = req.body || {};
    const password = String(body.password || "");

    if (!password) {
        return res.status(400).json({
            success: false,
            error: "Password is required"
        });
    }

    // ================================
    // CHECK PASSWORD
    // ================================
    if (password !== adminPassword) {
        return res.status(401).json({
            success: false,
            error: "Invalid admin password"
        });
    }

    // ================================
    // LOGIN SUCCESS
    // ================================
    return res.status(200).json({
        success: true,
        message: "Admin authentication successful"
    });
}
