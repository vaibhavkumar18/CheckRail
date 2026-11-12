import express from "express";
import * as authMiddleware from "../../middleware/auth.middleware.js";
import * as controller from "./dashboard.controllers.js";

const router = express.Router();

router.get("/", authMiddleware.authenticateUser, controller.getDashboard);

export default router;
