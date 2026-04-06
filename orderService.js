const { v4: uuidv4 } = require("uuid");
const Order = require("../models/Order");

// ── Create a new order ─────────────────────────────────────────────────────────
async function createOrder({ phone, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order must contain at least one item");
  }

  // Validate and calculate total
  let totalAmount = 0;
  for (const item of items) {
    if (!item.name || !item.quantity || !item.price) {
      throw new Error("Each item must have name, quantity, and price");
    }
    if (item.quantity < 1 || item.price < 0) {
      throw new Error("Invalid item quantity or price");
    }
    totalAmount += item.quantity * item.price;
  }

  if (totalAmount < 1) {
    throw new Error("Total amount must be at least KSh 1");
  }

  const orderId = `SYL-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;

  const order = await Order.create({
    orderId,
    customerPhone: phone,
    items,
    totalAmount: Math.ceil(totalAmount),
    status: "PENDING",
  });

  return order;
}

// ── Get order by ID ────────────────────────────────────────────────────────────
async function getOrderById(orderId) {
  const order = await Order.findOne({ orderId });
  if (!order) throw new Error(`Order not found: ${orderId}`);
  return order;
}

// ── Mark order as PROCESSING when STK push is sent ─────────────────────────────
async function markOrderProcessing(orderId, { checkoutRequestId, merchantRequestId }) {
  return Order.findOneAndUpdate(
    { orderId, status: "PENDING" },
    {
      status: "PROCESSING",
      checkoutRequestId,
      merchantRequestId,
      stkPushInitiatedAt: new Date(),
    },
    { new: true }
  );
}

// ── Handle M-Pesa callback result ──────────────────────────────────────────────
async function processCallbackResult(callbackData) {
  const body = callbackData?.Body?.stkCallback;

  if (!body) throw new Error("Invalid callback structure");

  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;

  // Find the order by CheckoutRequestID
  const order = await Order.findOne({ checkoutRequestId: CheckoutRequestID });

  if (!order) {
    console.warn(`[CALLBACK] No order found for CheckoutRequestID: ${CheckoutRequestID}`);
    return null;
  }

  // ── Idempotency: skip if already processed ──────────────────────────────────
  if (order.status === "PAID" || order.status === "FAILED") {
    console.log(`[CALLBACK] Order ${order.orderId} already processed. Skipping.`);
    return order;
  }

  // ── Payment SUCCESSFUL ──────────────────────────────────────────────────────
  if (ResultCode === 0) {
    const meta = {};
    if (CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        meta[item.Name] = item.Value;
      }
    }

    const receiptNumber = meta["MpesaReceiptNumber"];

    // Check for duplicate receipt number (extra safety)
    if (receiptNumber) {
      const duplicate = await Order.findOne({ mpesaReceiptNumber: receiptNumber });
      if (duplicate && duplicate.orderId !== order.orderId) {
        console.warn(`[CALLBACK] Duplicate receipt ${receiptNumber} — already on order ${duplicate.orderId}`);
        return order;
      }
    }

    await Order.findByIdAndUpdate(order._id, {
      status: "PAID",
      mpesaReceiptNumber: receiptNumber || null,
      mpesaTransactionDate: String(meta["TransactionDate"] || ""),
      paidAt: new Date(),
    });

    console.log(`✅  [CALLBACK] Order ${order.orderId} PAID — Receipt: ${receiptNumber}`);
    return { ...order.toObject(), status: "PAID" };
  }

  // ── Payment FAILED / Cancelled ──────────────────────────────────────────────
  await Order.findByIdAndUpdate(order._id, {
    status: "FAILED",
    failureReason: ResultDesc || "Payment failed",
  });

  console.log(`❌  [CALLBACK] Order ${order.orderId} FAILED — ${ResultDesc}`);
  return { ...order.toObject(), status: "FAILED" };
}

module.exports = { createOrder, getOrderById, markOrderProcessing, processCallbackResult };
