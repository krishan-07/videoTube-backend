import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content || content.trim() === "")
    throw new ApiError(400, "Tweet content is required");

  const tweet = await Tweet.create({
    owner: req.user?._id,
    content,
  });

  if (!tweet) throw new ApiError(500, "Error while creating a tweet");

  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Tweet created successfully"));
});

const getsUserTweet = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  let { page = 1, limit = 10 } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

  if (!userId || !isValidObjectId(userId))
    throw new ApiError(400, "User id is invalid");

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const tweet = await Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
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
        foreignField: "tweet",
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
        owner: 1,
        likesCount: 1,
        isLiked: 1,
        content: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  if (!tweet) throw new ApiError(400, "Error while finding user tweets");

  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "user tweet fetched successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const { tweetId } = req.params;

  if (!tweetId || !isValidObjectId(tweetId))
    throw new ApiError(400, "Tweet id is invalid");

  if (!content || content.trim() === "")
    throw new ApiError(400, "Tweet content is required");

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) throw new ApiError(404, "tweet not found");

  if (tweet.owner.toString() !== req.user?._id.toString())
    throw new ApiError(
      401,
      "You don't have permission to access this request "
    );

  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: { content },
    },
    { new: true }
  );

  if (!updatedTweet) throw new ApiError(400, "Error while updating tweet");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!tweetId || !isValidObjectId(tweetId))
    throw new ApiError(400, "tweet id is invalid");

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) throw new ApiError(404, "tweet not found");

  if (tweet.owner.toString() !== req.user?._id.toString())
    throw new ApiError(
      401,
      "You don't have permission to access this request "
    );

  const deletedTweet = await Tweet.findByIdAndDelete(tweetId);
  if (!deletedTweet) throw new ApiError(400, "Error while deleting the tweet");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "tweet deleted successfully"));
});

export { createTweet, getsUserTweet, deleteTweet, updateTweet };
