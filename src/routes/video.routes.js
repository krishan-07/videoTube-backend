import { Router } from "express";
import { upload } from "../middleware/multer..middleware.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishVideo,
  updateVideo,
} from "../controllers/video.controller.js";

const router = Router();
router.use(verifyJWT);

router
  .route("/")
  .post(
    upload.fields([
      {
        name: "videoFile",
        maxCount: 1,
      },
      {
        name: "thumbnail",
        maxCount: 1,
      },
    ]),
    publishVideo
  )
  .get(getAllVideos);

router
  .route("/:videoId")
  .get(getVideoById)
  .patch(upload.single("thumbnail"), updateVideo)
  .delete(deleteVideo);

export default router;
