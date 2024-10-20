import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Video } from "../models/video.model.js";
import {
  uploadOnCloudinary,
  removeFromCloudinary,
  extractPublicIdFromUrl,
} from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";
import mongoose, { isValidObjectId } from "mongoose";

const publishVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title || title.trim() === "")
    throw new ApiError(400, "title is required");

  const videoLocalPath = req.files?.video[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!videoLocalPath || !thumbnailLocalPath)
    throw new ApiError(400, "video and thumbnail files are required");

  const videoFile = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoFile.url || !thumbnail.url)
    throw new ApiError(400, "Error while uploading on cloudinary");

  const video = await Video.create({
    videoFile: videoFile.url,
    thumbnail: thumbnail.url,
    title,
    description: description || "",
    duration: videoFile.duration,
    isPublished: true,
    owner: req.user?._id,
  });

  if (!video)
    throw new ApiError(500, "Something went wrong while uploading the video");

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video Id");

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscriberCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              fullname: 1,
              userName: 1,
              avatar: 1,
              subscriberCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        videoFile: 1,
        thumbnail: 1,
        description: 1,
        title: 1,
        duration: 1,
        likesCount: 1,
        isLiked: 1,
        owner: 1,
        views: 1,
        comments: 1,
        createdAt: 1,
      },
    },
  ]);

  if (!video.length) throw new ApiError(404, "Video not found");

  await Video.findByIdAndUpdate(videoId, {
    $inc: {
      views: 1,
    },
  });

  await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
      watchHistory: videoId,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video Id");

  if (!title && !description && !videoLocalPath)
    throw new ApiError(400, "Atleat one field is required");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  if (video.owner.toString() !== req.user?._id?.toString())
    throw new ApiError(401, "You dont have permission to edit this video");

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnail)
    throw new ApiError(400, "Error while uploading to Cloudinary");
  else {
    const response = await removeFromCloudinary(
      extractPublicIdFromUrl(video.thumbnail)
    );
    if (response.result !== "ok")
      throw new ApiError(400, "Error while removing the old file");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      title: title || video.title,
      description: description || video.description,
      thumbnail: thumbnail.url || video.thumbnail,
    },
    { new: true }
  );

  if (!updateVideo) throw new ApiError(500, "Error while uploading to server");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !isValidObjectId(videoId))
    throw new ApiError(400, "Invalid video id");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  if (video.owner.toString() !== req.user?._id?.toString())
    throw new ApiError(401, "You dont have permission to delete this video");

  const deletedVideo = await Video.findByIdAndDelete(videoId);
  if (!deletedVideo)
    throw new ApiError(500, "Error while deleting video from the server");
  else {
    const videoResponse = await removeFromCloudinary(
      extractPublicIdFromUrl(video.videoFile)
    );
    const thumbnailResponse = await removeFromCloudinary(
      extractPublicIdFromUrl(video.thumbnail)
    );
    if (videoResponse !== "ok")
      throw new ApiError(400, "Error while removing from Cloudinary");
    if (thumbnailResponse !== "ok")
      throw new ApiError(400, "Error while removing from Cloudinary");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !isValidObjectId(videoId))
    throw new ApiError(400, "Invalid video id");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  if (video.owner.toString() !== req.user?._id?.toString())
    throw new ApiError(401, "You dont have permission to perform this action");

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video?.isPublished,
      },
    },
    {
      new: true,
    }
  );

  if (!updatedVideo)
    throw new ApiError(500, "Error while toggling publish status");

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedVideo, "Publish status toggled successfully")
    );
});

const getAllVideos = asyncHandler(async (req, res) => {
  let { page = 1, limit = 10, query, sortBy, sortType } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);

  const skip = (page - 1) * limit;

  const match = query
    ? {
        $or: [
          { title: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
      }
    : {};

  const videos = await Video.aggregate([
    { $match: match },
    { $match: { isPublished: true } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              avatar: 1,
              fullName: 1,
              userName: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $project: {
        title: 1,
        description: 1,
        thumbnail: 1,
        videoFile: 1,
        owner: 1,
        views: 1,
        createdAt: 1,
        duration: 1,
      },
    },
    {
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    },
    {
      $limit: limit,
    },
    {
      $skip: skip,
    },
  ]);

  if (!videos) throw new ApiError(404, "No videos found");

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "All videos fetched successfully"));
});

export {
  publishVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
  getAllVideos,
};
