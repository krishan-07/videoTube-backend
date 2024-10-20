import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Subscription } from "../models/subscription.model.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId || !isValidObjectId(channelId))
    throw new ApiError(400, "Invalid channel Id");

  if (channelId.toString() === req.user?._id.toString())
    throw new ApiError(400, "Cannot subscribe to own channel");

  const channel = await Subscription.findOne({
    $and: [{ subscriber: req.user?._id }, { channel: channelId }],
  });

  if (channel) {
    const removeSubscription = await Subscription.findByIdAndDelete(
      channel._id
    );
    if (!removeSubscription)
      throw new ApiError(500, "Error while unsubscribing the channel");

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Subscription removed successfully"));
  } else {
    const addSubscription = await Subscription.create({
      subscriber: req.user?._id,
      channel: channelId,
    });
    if (!addSubscription)
      throw new ApiError(500, "Error while sbscribing the channel");

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Subscription added successfully"));
  }
});

const getUserChannelSubscriber = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId || !isValidObjectId(channelId))
    throw new ApiError(400, "Invalid channel Id");

  const subscribers = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              fullName: 1,
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
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscribers",
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
      $project: {
        _id: 0,
        owner: 1,
        subscribers: 1,
        subscribersCount: { $size: "$subscribers" },
      },
    },
  ]);

  if (!subscribers) throw new ApiError(404, "No subscribers found");

  if (subscribers.length === 0)
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { subscribersCount: 0 },
          "Subscribers fetched successfully"
        )
      );

  return res
    .status(200)
    .json(
      new ApiResponse(200, subscribers[0], "Subscribers fetched successfully")
    );
});

const getSubscribedChannel = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!subscriberId || !isValidObjectId(subscriberId))
    throw new ApiError(400, "Invalid subscriber Id");

  const subscribedChannel = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channels",
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
              subscribersCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: {
                    $in: [
                      new mongoose.Types.ObjectId(subscriberId),
                      "$subscribers.subscriber",
                    ],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              fullName: 1,
              userName: 1,
              avatar: 1,
              subscribersCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        channelCount: {
          $size: "$channels",
        },
      },
    },
    {
      $project: {
        _id: 0,
        channels: 1,
        channelCount: 1,
      },
    },
  ]);

  if (!subscribedChannel) throw new ApiError(404, "No channels found");

  if (subscribedChannel.length === 0)
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { subscribedChannel: 0 },
          "Channel Subscribed fetched successfully"
        )
      );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannel[0],
        "Channel Subscribed fetched successfully"
      )
    );
});

export { toggleSubscription, getSubscribedChannel, getUserChannelSubscriber };
