require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./db");

const orderRoutes = require("./orderRoutes");
const paymentRoutes = require("./paymentRoutes");

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*" }));
app.use(express.json());
app.use(morgan("combined"));

// ── Database ────────────────────────────────────────────────────────────────
connectDB();

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api", orderRoutes);
app.use("/api", paymentRoutes);

// ── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Sylmar Hardware M-Pesa API", time: new Date() });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ success: false, message: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅  Sylmar M-Pesa API running on port ${PORT}`);
  console.log(`   Callback URL: ${process.env.MPESA_CALLBACK_URL}`);
});
