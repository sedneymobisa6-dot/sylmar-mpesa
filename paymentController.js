const { initiateSTKPush, formatPhone } = require("../services/darajaService");
const { getOrderById, markOrderProcessing, processCallbackResult } = require("../services/orderService");

// POST /api/stkpush
// Frontend sends { orderId, phone } — system initiates STK prompt on customer's phone
async function stkPush(req, res) {
  try {
    const { orderId, phone } = req.body;

    if (!orderId) return res.status(400).json({ success: false, message: "orderId is required" });
    if (!phone)   return res.status(400).json({ success: false, message: "phone is required" });

    // 1. Fetch order
    const order = await getOrderById(orderId);

    if (order.status === "PAID") {
      return res.status(400).json({ success: false, message: "This order is already paid" });
    }
    if (order.status === "PROCESSING") {
      return res.status(400).json({
        success: false,
        message: "STK Push already sent. Please check your phone.",
      });
    }

    // 2. Validate phone
    let formattedPhone;
    try {
      formattedPhone = formatPhone(phone);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid Safaricom phone number" });
    }

    // 3. Initiate STK Push
    const darajaResponse = await initiateSTKPush({
      phone: formattedPhone,
      amount: order.totalAmount,
      orderId: order.orderId,
      description: `Sylmar Hardware - Order ${order.orderId}`,
    });

    if (darajaResponse.ResponseCode !== "0") {
      return res.status(502).json({
        success: false,
        message: "M-Pesa service rejected the request",
        details: darajaResponse.ResponseDescription,
      });
    }

    // 4. Store CheckoutRequestID so we can match the callback
    await markOrderProcessing(order.orderId, {
      checkoutRequestId: darajaResponse.CheckoutRequestID,
      merchantRequestId: darajaResponse.MerchantRequestID,
    });

    return res.json({
      success: true,
      message: "STK Push sent. Ask customer to enter M-Pesa PIN.",
      data: {
        orderId: order.orderId,
        checkoutRequestId: darajaResponse.CheckoutRequestID,
        customerMessage: darajaResponse.CustomerMessage,
      },
    });
  } catch (err) {
    console.error("[STK PUSH ERROR]", err.message);
    return res.status(500).json({ success: false, message: "Failed to initiate payment" });
  }
}

// POST /api/callback
// Safaricom calls this automatically after customer enters PIN (or cancels)
// This endpoint MUST be publicly accessible via HTTPS
async function mpesaCallback(req, res) {
  // Always respond 200 IMMEDIATELY — Safaricom retries if we don't
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const callbackData = req.body;
    console.log("[CALLBACK RECEIVED]", JSON.stringify(callbackData, null, 2));

    await processCallbackResult(callbackData);
  } catch (err) {
    // Log but don't crash — response is already sent
    console.error("[CALLBACK PROCESSING ERROR]", err.message);
  }
}

module.exports = { stkPush, mpesaCallback };
