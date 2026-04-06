const axios = require("axios");

// ── Daraja base URLs ──────────────────────────────────────────────────────────
const DARAJA_BASE =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

// ── 1. OAuth Token ─────────────────────────────────────────────────────────────
// Tokens are valid for 1 hour. We cache to avoid hammering the auth endpoint.
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const credentials = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const response = await axios.get(
    `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${credentials}` },
      timeout: 10000,
    }
  );

  cachedToken = response.data.access_token;
  // Expire 5 minutes before actual expiry (safety buffer)
  tokenExpiresAt = now + (parseInt(response.data.expires_in) - 300) * 1000;

  return cachedToken;
}

// ── 2. Timestamp & Password ────────────────────────────────────────────────────
function generateTimestamp() {
  // Format: YYYYMMDDHHmmss
  return new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
}

function generatePassword(timestamp) {
  const raw = `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`;
  return Buffer.from(raw).toString("base64");
}

// ── 3. Format Phone Number ────────────────────────────────────────────────────
// Accepts: 07XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX → returns 2547XXXXXXXX
function formatPhone(phone) {
  const cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.startsWith("0")) return `254${cleaned.slice(1)}`;
  if (cleaned.startsWith("254")) return cleaned;
  if (cleaned.startsWith("+254")) return cleaned.slice(1);
  throw new Error(`Invalid phone number: ${phone}`);
}

// ── 4. STK Push ───────────────────────────────────────────────────────────────
async function initiateSTKPush({ phone, amount, orderId, description }) {
  const token = await getAccessToken();
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);
  const formattedPhone = formatPhone(phone);

  // Amount must be a whole number (KES)
  const roundedAmount = Math.ceil(amount);

  const payload = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: roundedAmount,
    PartyA: formattedPhone,         // customer phone
    PartyB: process.env.MPESA_SHORTCODE,
    PhoneNumber: formattedPhone,    // phone that receives STK prompt
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: orderId,      // this is how we match callback to order
    TransactionDesc: description || "Sylmar Hardware Payment",
  };

  const response = await axios.post(
    `${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );

  return response.data;
  // Returns: { MerchantRequestID, CheckoutRequestID, ResponseCode, ResponseDescription, CustomerMessage }
}

module.exports = { initiateSTKPush, formatPhone };
