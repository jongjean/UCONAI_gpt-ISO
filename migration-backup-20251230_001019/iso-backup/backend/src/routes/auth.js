import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import prisma from "../core/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();
const ACCESS_EXPIRES = process.env.ACCESS_EXPIRES || "24h";
const REFRESH_EXPIRES = process.env.REFRESH_EXPIRES || "7d";
const JWT_SECRET = process.env.JWT_SECRET || "changeme-access";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "changeme-refresh";
const TOTP_WINDOW = Number.parseInt(process.env.TOTP_WINDOW || "1", 10);

const APPROVED_STATUS = "APPROVED";
const PENDING_STATUS = "PENDING";
const REJECTED_STATUS = "REJECTED";
const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

function signTokens(user) {
  const payload = {
    uid: user.id,
    email: user.email,
    role: user.role,
  };
  const access = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
  const refresh = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
  return { access, refresh };
}

router.post("/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email/password required" });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "email exists" });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      status: PENDING_STATUS,
      role: "USER",
    },
  });
  return res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
    },
    message: "Account created. Await administrator approval before logging in.",
  });
});

router.post("/login", async (req, res) => {
  const { email, password, otp } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email/password required" });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });
  if (user.status !== APPROVED_STATUS) {
    return res.status(403).json({ error: "account requires administrator approval" });
  }
  if (user.totpEnabled) {
    if (!user.totpSecret) {
      return res.status(500).json({ error: "totp misconfigured" });
    }
    if (!otp) return res.status(401).json({ error: "otp required" });
    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: "base32",
      token: otp,
      window: Number.isNaN(TOTP_WINDOW) ? 1 : TOTP_WINDOW,
    });
    if (!verified) return res.status(401).json({ error: "invalid otp" });
  }
  const tokens = signTokens(user);
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
      totpEnabled: user.totpEnabled,
    },
    tokens,
  });
});

router.post("/refresh", async (req, res) => {
  const { refresh } = req.body || {};
  if (!refresh) return res.status(400).json({ error: "refresh required" });
  try {
    const payload = jwt.verify(refresh, JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.uid } });
    if (!user || user.status !== APPROVED_STATUS) {
      return res.status(401).json({ error: "invalid refresh" });
    }
    const tokens = signTokens(user);
    return res.json({ tokens });
  } catch (e) {
    return res.status(401).json({ error: "invalid refresh" });
  }
});

router.post("/totp/setup", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.uid } });
  if (!user) return res.status(404).json({ error: "user not found" });
  if (user.status !== APPROVED_STATUS) {
    return res.status(403).json({ error: "account requires administrator approval" });
  }
  if (user.totpEnabled) {
    return res.status(400).json({ error: "totp already enabled" });
  }

  const secret = speakeasy.generateSecret({
    name: `UCONAI (${user.email})`,
    length: 32,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpSecret: secret.base32,
      totpEnabled: false,
    },
  });

  const qrImage = await QRCode.toDataURL(secret.otpauth_url);
  return res.json({
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrImage,
  });
});

router.post("/totp/verify", requireAuth, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "otp required" });

  const user = await prisma.user.findUnique({ where: { id: req.user.uid } });
  if (!user) return res.status(404).json({ error: "user not found" });
  if (!user.totpSecret) return res.status(400).json({ error: "totp not initialized" });

  const verified = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: "base32",
    token,
    window: Number.isNaN(TOTP_WINDOW) ? 1 : TOTP_WINDOW,
  });

  if (!verified) return res.status(401).json({ error: "invalid otp" });

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true },
  });

  return res.json({ message: "totp enabled" });
});

router.post("/totp/disable", requireAuth, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "otp required" });

  const user = await prisma.user.findUnique({ where: { id: req.user.uid } });
  if (!user) return res.status(404).json({ error: "user not found" });
  if (!user.totpEnabled || !user.totpSecret) {
    return res.status(400).json({ error: "totp not enabled" });
  }

  const verified = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: "base32",
    token,
    window: Number.isNaN(TOTP_WINDOW) ? 1 : TOTP_WINDOW,
  });

  if (!verified) return res.status(401).json({ error: "invalid otp" });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: false,
      totpSecret: null,
    },
  });

  return res.json({ message: "totp disabled" });
});

router.get(
  "/admin/users/pending",
  requireAuth,
  requireRole(SUPER_ADMIN_ROLE),
  async (_req, res) => {
    const pending = await prisma.user.findMany({
      where: { status: { in: [PENDING_STATUS, REJECTED_STATUS, APPROVED_STATUS] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        createdAt: true,
        role: true,
        status: true,
      },
    });
    return res.json({ users: pending });
  }
);

router.post(
  "/admin/users/:id/approve",
  requireAuth,
  requireRole(SUPER_ADMIN_ROLE),
  async (req, res) => {
    const { id } = req.params;
    const { role } = req.body || {};

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "user not found" });

    const targetRole = role === SUPER_ADMIN_ROLE ? SUPER_ADMIN_ROLE : "USER";

    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: APPROVED_STATUS,
        role: targetRole,
        approvedAt: new Date(),
        approvedById: req.user.uid,
      },
    });

    return res.json({
      user: {
        id: updated.id,
        email: updated.email,
        status: updated.status,
        role: updated.role,
        approvedAt: updated.approvedAt,
      },
    });
  }
);

router.post(
  "/admin/users/:id/reject",
  requireAuth,
  requireRole(SUPER_ADMIN_ROLE),
  async (req, res) => {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "user not found" });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: REJECTED_STATUS,
        approvedAt: new Date(),
        approvedById: req.user.uid,
        totpEnabled: false,
        totpSecret: null,
      },
    });

    return res.json({
      user: {
        id: updated.id,
        email: updated.email,
        status: updated.status,
        role: updated.role,
        approvedAt: updated.approvedAt,
      },
    });
  }
);

router.delete(
  "/admin/users/:id",
  requireAuth,
  requireRole(SUPER_ADMIN_ROLE),
  async (req, res) => {
    const { id } = req.params;

    if (id === req.user.uid) {
      return res.status(400).json({ error: "cannot delete current administrator" });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "user not found" });

    await prisma.user.delete({ where: { id } });

    return res.json({ message: "deleted" });
  }
);

export default router;
