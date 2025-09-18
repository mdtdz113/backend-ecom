import express from "express";
import { authMiddleware } from "../middleware/middleware.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";
import {
    createCampaign,
    listCampaigns,
    getCampaign,
    pauseCampaign,
    resumeCampaign,
    manualRelease,
} from "../controller/promotionCampaign.js";

const router = express.Router();

router.post(
    "/promotions/campaigns",
    authMiddleware,
    adminMiddleware,
    createCampaign
);
router.get(
    "/promotions/campaigns",
    authMiddleware,
    adminMiddleware,
    listCampaigns
);
router.get(
    "/promotions/campaigns/:id",
    authMiddleware,
    adminMiddleware,
    getCampaign
);
router.post(
    "/promotions/campaigns/:id/pause",
    authMiddleware,
    adminMiddleware,
    pauseCampaign
);
router.post(
    "/promotions/campaigns/:id/resume",
    authMiddleware,
    adminMiddleware,
    resumeCampaign
);
router.post(
    "/promotions/campaigns/:id/release",
    authMiddleware,
    adminMiddleware,
    manualRelease
);

export default router;
