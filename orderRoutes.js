const express = require("express");
const router = express.Router();
const { checkout, getOrder } = require("./orderController");

router.post("/checkout", checkout);
router.get("/order/:id", getOrder);

module.exports = router;
