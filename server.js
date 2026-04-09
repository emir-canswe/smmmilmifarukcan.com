"use strict";

require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
  })
);

app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true, limit: "32kb" }));

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: false, maxAge: isProd ? "7d" : 0 }));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 8 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Çok fazla istek. Lütfen bir süre sonra tekrar deneyin." },
});

function sanitize(str) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, 8000);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendMail({ name, email, phone, message }) {
  const host = process.env.SMTP_HOST;
  const mailTo = process.env.MAIL_TO || "ilmifarukcan@gmail.com";

  const text = [
    `Web sitesi iletişim formu`,
    ``,
    `Ad Soyad: ${name}`,
    `E-posta: ${email}`,
    `Telefon: ${phone || "-"}`,
    ``,
    `Mesaj:`,
    message,
  ].join("\n");

  if (!host) {
    console.log("[contact] SMTP tanımlı değil — konsol çıktısı:\n" + text);
    return { mode: "log" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  const from = process.env.MAIL_FROM || process.env.SMTP_USER || mailTo;

  await transporter.sendMail({
    from: `"${name}" <${from}>`,
    replyTo: email,
    to: mailTo,
    subject: `[Web Formu] ${name}`,
    text,
  });

  return { mode: "smtp" };
}

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "smmm-web" });
});

app.post("/api/contact", contactLimiter, async (req, res) => {
  try {
    const name = sanitize(req.body.name);
    const email = sanitize(req.body.email).toLowerCase();
    const phone = sanitize(req.body.phone);
    const message = sanitize(req.body.message);

    if (name.length < 2 || name.length > 200) {
      return res.status(400).json({ ok: false, error: "Lütfen geçerli bir ad soyad girin." });
    }
    if (!isValidEmail(email) || email.length > 254) {
      return res.status(400).json({ ok: false, error: "Lütfen geçerli bir e-posta adresi girin." });
    }
    if (message.length < 10) {
      return res.status(400).json({ ok: false, error: "Mesaj en az 10 karakter olmalıdır." });
    }

    await sendMail({ name, email, phone, message });
    res.json({ ok: true });
  } catch (err) {
    console.error("[contact]", err);
    res.status(500).json({ ok: false, error: "Mesaj gönderilemedi. Lütfen daha sonra tekrar deneyin." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const MAX_PORT_TRIES = 30;
const basePort = PORT;

function listenOnPort(port, attempt) {
  const server = app.listen(port, () => {
    if (port !== basePort) {
      console.warn(
        `Not: ${basePort} portu doluydu; ${port} kullanılıyor. Tarayıcıda: http://localhost:${port}`
      );
    }
    console.log(`Sunucu: http://localhost:${port} (${isProd ? "production" : "development"})`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && attempt + 1 < MAX_PORT_TRIES) {
      const next = port + 1;
      console.warn(`Port ${port} meşgul → ${next} deneniyor...`);
      listenOnPort(next, attempt + 1);
      return;
    }
    if (err.code === "EADDRINUSE") {
      console.error(
        `\n[Hata] ${basePort}–${port} aralığında boş port bulunamadı (EADDRINUSE).\n\n` +
          "İşlemi kapatın (LISTENING satırındaki son sütun = PID):\n" +
          `  netstat -ano | findstr :${basePort}\n` +
          "  taskkill /PID <PID> /F\n\n" +
          "Veya tek seferlik başka taban port (ör. 3050):\n" +
          "  PowerShell: $env:PORT=3050; npm start\n"
      );
      process.exit(1);
    }
    throw err;
  });
}

listenOnPort(basePort, 0);
