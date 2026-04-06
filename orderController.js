const { createOrder, getOrderById } = require("../services/orderService");

// POST /api/checkout
// Creates a new order and returns orderId + total for frontend to use
async function checkout(req, res) {
  try {
    const { phone, items } = req.body;

    if (!phone) return res.status(400).json({ success: false, message: "Phone number is required" });
    if (!items) return res.status(400).json({ success: false, message: "Items are required" });

    const order = await createOrder({ phone, items });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        status: order.status,
        itemCount: order.items.length,
      },
    });
  } catch (err) {
    console.error("[CHECKOUT ERROR]", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
}

// GET /api/order/:id
// Frontend polls this to know if payment has been confirmed
async function getOrder(req, res) {
  try {
    const order = await getOrderById(req.params.id);

    return res.json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        totalAmount: order.totalAmount,
        items: order.items,
        mpesaReceiptNumber: order.mpesaReceiptNumber || null,
        paidAt: order.paidAt || null,
        failureReason: order.failureReason || null,
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
}

module.exports = { checkout, getOrder };
