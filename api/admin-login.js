import crypto from "crypto";

export default async function handler(req, res) {

    // ==========================================
    // CORS
    // ==========================================

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

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

    // ==========================================
    // ENVIRONMENT VARIABLES
    // ==========================================

    const adminPassword =
        process.env.ADMIN_PASSWORD;

    const sessionSecret =
        process.env.ADMIN_SESSION_SECRET;

    if (!adminPassword) {
        return res.status(500).json({
            success: false,
            error:
                "ADMIN_PASSWORD is not configured"
        });
    }

    if (!sessionSecret) {
        return res.status(500).json({
            success: false,
            error:
                "ADMIN_SESSION_SECRET is not configured"
        });
    }

    // ==========================================
    // REQUEST
    // ==========================================

    const body = req.body || {};

    const password =
        String(body.password || "");

    if (!password) {
        return res.status(400).json({
            success: false,
            error: "Password is required"
        });
    }

    // ==========================================
    // PASSWORD CHECK
    // ==========================================

    if (password !== adminPassword) {

        return res.status(401).json({
            success: false,
            error: "Invalid admin password"
        });
    }

    // ==========================================
    // CREATE SESSION
    // ==========================================

    const issuedAt =
        Date.now();

    const expiresAt =
        issuedAt +
        (8 * 60 * 60 * 1000);

    const payload =
        `admin:${expiresAt}`;

    const signature =
        crypto
            .createHmac(
                "sha256",
                sessionSecret
            )
            .update(payload)
            .digest("hex");

    const sessionToken =
        Buffer
            .from(
                `${payload}:${signature}`
            )
            .toString("base64url");

    // ==========================================
    // SECURE HTTP-ONLY COOKIE
    // ==========================================

    res.setHeader(
        "Set-Cookie",
        `admin_session=${sessionToken}; ` +
        `Path=/; ` +
        `HttpOnly; ` +
        `Secure; ` +
        `SameSite=Strict; ` +
        `Max-Age=28800`
    );

    // ==========================================
    // SUCCESS
    // ==========================================

    return res.status(200).json({
        success: true,
        message: "Admin login successful",
        expiresAt
    });
}
