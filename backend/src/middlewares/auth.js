import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "changeme-access";

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "auth required" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      uid: payload.uid,
      email: payload.email,
      role: payload.role || "USER",
    };
    return next();
  } catch (e) {
    return res.status(401).json({ error: "invalid token" });
  }
}

export function requireRole(role) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "auth required" });
    if (req.user.role !== role) {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  };
}
