import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name || name.trim() === "")
    throw new ApiError(400, "Playlist name is required");

  const playlist = await Playlist.create({
    name,
    description: description || "",
    owner: req.user?._id,
  });

  if (!playlist) throw new ApiError(500, "Error while creating a playlist");

  return res
    .status(201)
    .json(new ApiResponse(201, playlist, "playlist created successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.parmas;

  if (!userId || !isValidObjectId(userId))
    throw new ApiError(400, "Invalid userId");

  const playlists = await Playlist.aggregate([
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
      $unwind: "$owner",
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          {
            $match: {
              isPublished: true,
            },
          },
          {
            $project: {
              thumbnail: 1,
              title: 1,
              videoFile: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        owner: 1,
        videos: 1,
        totalVideos: {
          $size: "$videos",
        },
        totalview: {
          $sum: "$videos.views",
        },
        thumbnail: {
          $first: "$videos.thumbnail",
        },
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  if (!playlists) throw new ApiError(404, "Playlists not found");

  return res
    .status(200)
    .json(new ApiResponse(200, playlists, "Playlists fetched successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.parmas;

  if (!playlistId || !isValidObjectId(playlistId))
    throw new ApiError(400, "Invalid PlaylistId");

  const playlist = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: {
          $project: {
            fullName: 1,
            userName: 1,
            avatar: 1,
          },
        },
      },
    },
    {
      $unwind: "$owner",
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
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
        ],
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        owner: 1,
        videos: 1,
        totalVideos: {
          $size: "$videos",
        },
        totalViews: {
          $sum: "$videos.views",
        },
        thumbnail: {
          $first: "$videos.thumbnail",
        },
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);
  if (!playlist) throw new ApiError(404, "No playlist found ");

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "playlist fetched successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!playlistId || !isValidObjectId(playlistId))
    throw new ApiError(400, "Invalid PlaylistId");

  if (!videoId || !isValidObjectId(videoId))
    throw new ApiError(400, "Invalid videoId");

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) throw new ApiError(404, "Playlist not found");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  if (playlist?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      401,
      "you do not have permission to perform this action"
    );
  }

  if (playlist.videos.includes(videoId)) {
    throw new ApiError(400, "Video already in playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $addToSet: {
        videos: videoId,
      },
    },
    {
      new: true,
    }
  );

  if (!updatedPlaylist)
    throw new ApiError(500, "Error while adding video in the playlist");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedPlaylist, "Video added successfully"));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!playlistId || !isValidObjectId(playlistId))
    throw new ApiError(400, "Invalid PlaylistId");

  if (!videoId || !isValidObjectId(videoId))
    throw new ApiError(400, "Invalid videoId");

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) throw new ApiError(404, "Playlist not found");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  if (playlist?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      401,
      "you do not have permission to perform this action"
    );
  }

  if (!playlist.videos.includes(videoId)) {
    throw new ApiError(400, "Video not in the playlist");
  }

  const updatedplaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $pull: {
        videos: { _id: videoId },
      },
    },
    {
      new: true,
    }
  );

  if (!updatedplaylist) throw new ApiError(500, "Error while removing video");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedplaylist, "video removed successfully"));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!playlistId || !isValidObjectId(playlistId))
    throw new ApiError(400, "Invalid PlaylistId");

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) throw new ApiError(404, "Playlist not found");

  if (playlist?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      401,
      "you do not have permission to perform this action"
    );
  }

  const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);

  if (!deletedPlaylist)
    throw new ApiError(500, "Error while deleting playlist");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Playlist deleted successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!name || name.trim() === "")
    throw new ApiError(400, "Playlist name is required");

  if (!playlistId || !isValidObjectId(playlistId))
    throw new ApiError(400, "Invalid PlaylistId");

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) throw new ApiError(404, "Playlist not found");

  if (playlist?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      401,
      "you do not have permission to perform this action"
    );
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $set: {
        name,
        description: description || playlist.description,
      },
    },
    {
      new: true,
    }
  );

  if (!updatedPlaylist)
    throw new ApiError(500, "Error while updating playlist details");

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
    );
});

export {
  createPlaylist,
  updatePlaylist,
  addVideoToPlaylist,
  deletePlaylist,
  removeVideoFromPlaylist,
  getPlaylistById,
  getUserPlaylists,
};
