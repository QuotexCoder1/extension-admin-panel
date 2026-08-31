import crypto from "crypto";

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            error: "Method not allowed"
        });
    }

    try {

        const { password } = req.body || {};

        if (!password) {
            return res.status(400).json({
                success: false,
                error: "Password required"
            });
        }

        // Admin password
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

        if (!ADMIN_PASSWORD) {
            return res.status(500).json({
                success: false,
                error: "ADMIN_PASSWORD is not configured in Vercel"
            });
        }

        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({
                success: false,
                error: "Incorrect password"
            });
        }

        const secret = process.env.ADMIN_SESSION_SECRET;

        if (!secret) {
            return res.status(500).json({
                success: false,
                error: "ADMIN_SESSION_SECRET is not configured in Vercel"
            });
        }

        // Session valid for 7 days
        const expiresAt =
            Date.now() + (7 * 24 * 60 * 60 * 1000);

        const payload =
            `admin:${expiresAt}`;

        const signature =
            crypto
                .createHmac("sha256", secret)
                .update(payload)
                .digest("hex");

        const session =
            Buffer
                .from(
                    `${payload}:${signature}`,
                    "utf8"
                )
                .toString("base64url");

        res.setHeader(
            "Set-Cookie",
            `admin_session=${session}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`
        );

        return res.status(200).json({
            success: true,
            message: "Login successful"
        });

    } catch (error) {

        console.error("LOGIN ERROR:", error);

        return res.status(500).json({
            success: false,
            error: "Login failed"
        });
    }
}
