import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  createTweet,
  deleteTweet,
  getsUserTweet,
  updateTweet,
} from "../controllers/tweet.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/").post(createTweet);
router.route("/:tweetId").patch(updateTweet).delete(deleteTweet);
router.route("/user/:userId").get(getsUserTweet);

export default router;
