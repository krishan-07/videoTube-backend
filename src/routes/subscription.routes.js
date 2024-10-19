import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware";
import {
  getSubscribedChannel,
  getUserChannelSubscriber,
  toggleSubscription,
} from "../controllers/subscription.controller";

const router = Router();
router.use(verifyJWT);

router
  .route("/c/:channelId")
  .get(getUserChannelSubscriber)
  .post(toggleSubscription);

router.route("/s/:subscriberId").get(getSubscribedChannel);

export default router;
