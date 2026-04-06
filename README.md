# 🛒 Sylmar Hardware — M-Pesa Payment Backend

Production-ready Node.js backend for Lipa na M-Pesa STK Push payments.
Built for **Sylmar Hardware, Kisii** — easily reusable for any Kenyan e-commerce site.

---

## 📁 Project Structure

All files live in the **root directory** (flat structure — no sub-folders):

```
sylmar-mpesa/
├── server.js              # App entry point
├── db.js                  # MongoDB connection
├── order.js               # Mongoose schema
├── orderRoutes.js         # POST /checkout, GET /order/:id
├── paymentRoutes.js       # POST /stkpush, POST /callback
├── orderController.js     # Order creation & fetch logic
├── paymentController.js   # STK Push + Callback handler
├── darajaService.js       # Safaricom Daraja API (auth + STK push)
├── orderService.js        # Order CRUD + callback processing
├── package.json
└── .env                   # Environment variables (never commit this)
```

> ⚠️ **Why flat?** Render and some Linux hosts are case-sensitive and can fail
> to resolve nested `require()` paths. Keeping everything in the root avoids
> all `Cannot find module` errors at startup.

---

## 🚀 Local Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd sylmar-mpesa
npm install
```

### 2. Configure environment

Create a `.env` file in the root with the following variables:

```env
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/sylmar

MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_CALLBACK_URL=https://your-public-url.com/api/callback

ALLOWED_ORIGIN=*
```

### 3. Get Daraja credentials

1. Register at https://developer.safaricom.co.ke
2. Create an app → get **Consumer Key** and **Consumer Secret**
3. Use shortcode `174379` and the sandbox passkey for testing

### 4. Expose callback URL (local dev only)

Safaricom needs a public HTTPS URL. Use ngrok:

```bash
# Install ngrok: https://ngrok.com
ngrok http 3000

# Copy the HTTPS URL, e.g.:
# https://abc123.ngrok.io

# Set in .env:
MPESA_CALLBACK_URL=https://abc123.ngrok.io/api/callback
```

### 5. Start the server

```bash
npm run dev   # development (auto-restart)
npm start     # production
```

---

## 📡 API Reference

### POST `/api/checkout`
Creates an order and returns an `orderId`.

**Request:**
```json
{
  "phone": "0712345678",
  "items": [
    { "name": "Portland Cement 50kg", "quantity": 2, "price": 750 },
    { "name": "Steel Bars 12mm", "quantity": 1, "price": 8500 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "SYL-1719000000000-A3F2C1",
    "totalAmount": 10000,
    "status": "PENDING"
  }
}
```

---

### POST `/api/stkpush`
Sends STK Push prompt to customer's phone.

**Request:**
```json
{
  "orderId": "SYL-1719000000000-A3F2C1",
  "phone": "0712345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "STK Push sent. Ask customer to enter M-Pesa PIN.",
  "data": {
    "orderId": "SYL-1719000000000-A3F2C1",
    "checkoutRequestId": "ws_CO_...",
    "customerMessage": "Success. Request accepted..."
  }
}
```

---

### POST `/api/callback`
**Called automatically by Safaricom** — do not call this from your frontend.

---

### GET `/api/order/:id`
Poll for payment status from your frontend.

**Response (paid):**
```json
{
  "success": true,
  "data": {
    "orderId": "SYL-1719000000000-A3F2C1",
    "status": "PAID",
    "totalAmount": 10000,
    "mpesaReceiptNumber": "QHJ2A3K7LM",
    "paidAt": "2024-06-21T10:30:00.000Z"
  }
}
```

**Possible statuses:** `PENDING` → `PROCESSING` → `PAID` or `FAILED`

---

## 🌐 Deployment on Render (Recommended — Free Tier)

### 1. Push code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourname/sylmar-mpesa.git
git push -u origin main
```

### 2. Create Render Web Service

1. Go to https://render.com → **New Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node

### 3. Add Environment Variables in Render

In Render dashboard → **Environment** tab, add all variables from the list above.

Your callback URL will be:
```
https://your-service-name.onrender.com/api/callback
```

Set `MPESA_CALLBACK_URL` to that value before going live.

---

## 🖥️ Deployment on VPS (Ubuntu)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and install
git clone <repo> /var/www/sylmar-mpesa
cd /var/www/sylmar-mpesa
npm install

# Set environment variables
nano .env  # fill in all values

# Install PM2 process manager
npm install -g pm2
pm2 start server.js --name sylmar-mpesa
pm2 startup   # auto-restart on reboot
pm2 save

# Set up Nginx reverse proxy
sudo apt install nginx
```

Nginx config (`/etc/nginx/sites-available/sylmar-mpesa`):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then add SSL with Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 🔌 Frontend Integration (Any Framework)

### Step 1: Checkout (create order)
```javascript
const res = await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '0712345678', items: cart })
});
const { data } = await res.json();
const orderId = data.orderId;
```

### Step 2: Trigger STK Push
```javascript
await fetch('/api/stkpush', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orderId, phone: '0712345678' })
});
// Tell user: "Check your phone for M-Pesa prompt"
```

### Step 3: Poll for confirmation
```javascript
let confirmed = false;
const poll = setInterval(async () => {
  const res = await fetch(`/api/order/${orderId}`);
  const { data } = await res.json();

  if (data.status === 'PAID') {
    clearInterval(poll);
    showSuccessPage(data.mpesaReceiptNumber);
  } else if (data.status === 'FAILED') {
    clearInterval(poll);
    showErrorPage(data.failureReason);
  }
}, 3000); // check every 3 seconds

// Stop polling after 2 minutes
setTimeout(() => clearInterval(poll), 120000);
```

---

## 🔄 How Payment Confirmation Works (End-to-End)

```
Customer           Frontend           Backend           Safaricom
   │                  │                  │                  │
   │  Click "Pay"     │                  │                  │
   │─────────────────>│                  │                  │
   │                  │ POST /checkout   │                  │
   │                  │─────────────────>│                  │
   │                  │  orderId         │                  │
   │                  │<─────────────────│                  │
   │                  │ POST /stkpush    │                  │
   │                  │─────────────────>│ STK Push Request │
   │                  │                  │─────────────────>│
   │ 📱 M-Pesa prompt │                  │                  │
   │<─────────────────│                  │                  │
   │ Enter PIN ✅     │                  │                  │
   │─────────────────>│                  │                  │
   │                  │                  │ POST /callback   │
   │                  │                  │<─────────────────│
   │                  │                  │ Order → PAID     │
   │                  │ GET /order/:id   │                  │
   │                  │─────────────────>│                  │
   │  ✅ Success Page │  status: PAID    │                  │
   │<─────────────────│<─────────────────│                  │
```

**Key reliability features:**
- `CheckoutRequestID` links STK Push to callback — no guessing
- `MpesaReceiptNumber` is stored as unique — duplicate payments blocked
- Orders already `PAID`/`FAILED` are skipped on re-callback
- Callback always returns 200 immediately — Safaricom retries stop
- OAuth token cached — no rate limit issues on high traffic

---

## 🔐 Security Summary

| Threat | Protection |
|--------|-----------|
| Secrets in frontend | All keys in `.env` server-side only |
| Duplicate payments | `mpesaReceiptNumber` unique index in DB |
| Callback spoofing | Only Safaricom IPs post to `/callback`; validate ResultCode |
| Re-processing paid orders | Status check before processing |
| Phone number injection | `formatPhone()` strips non-digits, validates format |

---

## 🧪 Sandbox Test Numbers

Use these on Daraja sandbox:
- **Phone:** `254708374149` (Safaricom test number)
- **PIN:** `1234`
- **Shortcode:** `174379`
- **Passkey:** `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`
