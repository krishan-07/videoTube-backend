import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Video } from "../models/video.model.js";
import {
  uploadOnCloudinary,
  removeFromCloudinary,
  extractPublicIdFromUrl,
} from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";

const publishVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description)
    throw new ApiError(400, "title or description is required");

  const videoLocalPath = req.files?.video[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!videoLocalPath || !thumbnailLocalPath)
    throw new ApiError(400, "video and thumbnail files are required");

  const videoFile = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoFile.url || !thumbnail.url)
    throw new ApiError(400, "Error while uploading on cloudinary");

  const user = User.findById(req.user?._id).select(
    "-password -refreshToken -accessToken"
  );

  const video = await Video.create({
    videoFile: videoFile.url,
    thumbnail: thumbnail.url,
    title,
    description,
    duration: videoFile.duration,
    views: 0,
    isPublished: true,
    owner: user,
  });

  if (!video)
    throw new ApiError(500, "Something went wrong while uploading the video");

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video published successfully"));
});

export { publishVideo };
