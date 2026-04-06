const express = require("express");
const router = express.Router();
const { stkPush, mpesaCallback } = require("../controllers/paymentController");

router.post("/stkpush", stkPush);

// Safaricom posts to this URL after every payment attempt
// Must be HTTPS and publicly reachable
router.post("/callback", mpesaCallback);

module.exports = router;
