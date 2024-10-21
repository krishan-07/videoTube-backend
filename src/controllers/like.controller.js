import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Like } from "../models/like.model.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !isValidObjectId(videoId))
    throw new ApiError(400, "Invalid video id");

  const isLiked = await Like.findOne({
    $and: [
      {
        video: videoId,
      },
      {
        likedBy: req.user?._id,
      },
    ],
  });

  if (isLiked) {
    const removeLike = await Like.findByIdAndDelete(isLiked._id);
    if (!removeLike) throw new ApiError(400, "Error while removing like");

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Like removed successfully"));
  } else {
    const addLike = await Like.create({
      video: videoId,
      likedBy: req.user?._id,
    });
    if (!addLike) throw new ApiError(400, "Error while adding Like");

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Like added successfully"));
  }
});

const toggleTweetlike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!tweetId || !isValidObjectId(tweetId))
    throw new ApiError(400, "Invalid tweet id");

  const isLiked = await Like.findOne({
    $and: [
      {
        tweet: tweetId,
      },
      {
        likedBy: req.user?._id,
      },
    ],
  });

  if (isLiked) {
    const removeLike = await Like.findByIdAndDelete(isLiked._id);
    if (!removeLike) throw new ApiError(400, "Error while removing like");

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Like removed successfully"));
  } else {
    const addLike = await Like.create({
      tweet: tweetId,
      likedBy: req.user?._id,
    });
    if (!addLike) throw new ApiError(400, "Error while adding Like");

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Like added successfully"));
  }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!commentId || !isValidObjectId(commentId))
    throw new ApiError(400, "Invalid comment id");

  const isLiked = await Like.findOne({
    $and: [
      {
        comment: commentId,
      },
      {
        likedBy: req.user?._id,
      },
    ],
  });

  if (isLiked) {
    const removeLike = await Like.findByIdAndDelete(isLiked._id);
    if (!removeLike) throw new ApiError(400, "Error while removing like");

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Like removed successfully"));
  } else {
    const addLike = await Like.create({
      comment: commentId,
      likedBy: req.user?._id,
    });
    if (!addLike) throw new ApiError(400, "Error while adding Like");

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Like added successfully"));
  }
});

const getLikedVideos = asyncHandler(async (req, res) => {
  let { limit = 10, page = 1 } = req.params;
  limit = parseInt(limit);
  page = parseInt(page);
  const skip = (page - 1) * limit;

  const likedVideos = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $match: {
        video: { $exists: true },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: [
          {
            $match: {
              isPublished: true,
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
                  $project: {
                    fullName: 1,
                    userName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $unwind: "$owner",
          },
          {
            $project: {
              title: 1,
              description: 1,
              duration: 1,
              videoFile: 1,
              thumbnail: 1,
              owner: 1,
              views: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$video",
    },
    {
      $group: {
        _id: null,
        videos: { $push: "$video" },
        likedVideos: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        videos: 1,
        likedVideos: 1,
      },
    },
    {
      $limit: limit,
    },
    {
      $skip: skip,
    },
  ]);

  if (!likedVideos) throw new ApiError(400, "Error while getting videos");
  if (likedVideos[0].videos?.length === 0)
    return res
      .status(200)
      .json(
        new ApiResponse(200, { likedVideos: 0 }, "Videos fetched successfully")
      );

  return res
    .status(200)
    .json(new ApiResponse(200, likedVideos[0], "Videos fetched successfully"));
});

export { getLikedVideos, toggleCommentLike, toggleTweetlike, toggleVideoLike };
