import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  getSubscribedChannel,
  getUserChannelSubscriber,
  toggleSubscription,
} from "../controllers/subscription.controller.js";

const router = Router();
router.use(verifyJWT);

router
  .route("/c/:channelId")
  .get(getUserChannelSubscriber)
  .post(toggleSubscription);

router.route("/s/:subscriberId").get(getSubscribedChannel);

export default router;
