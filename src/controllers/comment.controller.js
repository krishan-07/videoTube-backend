import mongoose, { isValidObjectId } from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Comment } from "../models/comment.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const addComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const { videoId } = req.params;

  if (!content || content.trim() === "")
    throw new ApiError(400, "Please provide content in the comment");

  if (!videoId || !isValidObjectId(videoId))
    throw new ApiError(400, "Not a valid video id");

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: req.user?._id,
  });

  if (!comment) throw new ApiError(500, "Error while adding comment");

  return res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const { commentId } = req.params;

  if (!content || content.trim() === "")
    throw new ApiError(400, "Please provide content in the comment");

  if (!commentId || !isValidObjectId(commentId))
    throw new ApiError(400, "Not a valid comment id");

  const comment = await Comment.findById(commentId);

  if (!comment) throw new ApiError(404, "Comment not found");
  if (comment.owner.toString() !== req.user?._id.toString())
    throw new ApiError(401, "You dont have permission to edit this comment");

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $set: { content },
    },
    { new: true }
  );
  if (!updatedComment)
    throw new ApiError(400, "Error while updating the comment");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!commentId || !isValidObjectId(commentId))
    throw new ApiError(400, "Not a valid comment id");

  const comment = await Comment.findById(commentId);

  if (!comment) throw new ApiError(404, "Comment not found");
  if (comment.owner.toString() !== req.user?._id.toString())
    throw new ApiError(401, "You dont have permission to delete this comment");

  const deletedComment = await Comment.findByIdAndDelete(commentId);

  if (!deletedComment)
    throw new ApiError(400, "Error while deleting the comment");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Comment deleted successfully"));
});

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  let { page = 1, limit = 10 } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

  if (!videoId || !isValidObjectId(videoId))
    throw new ApiError(400, "Invalid video id");

  const comments = await Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
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
        foreignField: "comment",
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
        content: 1,
        owner: 1,
        video: 1,
        likesCount: 1,
        isLiked: 1,
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
      $limit: limit,
    },
    {
      $skip: skip,
    },
  ]);

  if (!comments) throw ApiError(400, "Error while getting comments");

  if (comments.length === 0)
    return res
      .status(200)
      .json(
        new ApiResponse(200, { comments: 0 }, "Comments fetched successfully")
      );

  return res
    .status(200)
    .json(new ApiResponse(200, comments[0], "Comments fetched successfully"));
});

export { addComment, updateComment, deleteComment, getVideoComments };
