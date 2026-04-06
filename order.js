const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    items: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED"],
      default: "PENDING",
    },

    // M-Pesa specific fields
    checkoutRequestId: {
      type: String,
      index: true,
      sparse: true,
    },
    merchantRequestId: {
      type: String,
      sparse: true,
    },
    mpesaReceiptNumber: {
      type: String,
      unique: true,
      sparse: true, // allows multiple nulls
      index: true,
    },
    mpesaTransactionDate: {
      type: String,
    },
    stkPushInitiatedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", OrderSchema);
