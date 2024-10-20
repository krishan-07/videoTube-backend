import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Subscription } from "../models/subscription.model.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId || !isValidObjectId(channelId))
    throw new ApiError(400, "Invalid channel Id");

  const channel = await Subscription.findOne({
    $and: [{ subscriber: req.user?._id }, { channel: channelId }],
  });

  if (channel) {
    const removeSubscription = await Subscription.findByIdAndDelete(
      channel._id
    );
    if (!removeSubscription)
      throw new ApiError(500, "Error while unsubscribing the channel");
  } else {
    const addSubscription = await Subscription.create({
      subscriber: req.user?._id,
      channel: channelId,
    });
    if (!addSubscription)
      throw new ApiError(500, "Error while sbscribing the channel");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Subscription toggled successfully"));
});

const getUserChannelSubscriber = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId || !isValidObjectId(channelId))
    throw new ApiError(400, "Invalid channel Id");

  const subscribers = Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscribers",
      },
    },
    {
      $addFields: {
        subscriber: {
          $first: "$subscribers",
        },
      },
    },
    {
      $group: {
        _id: null,
        subscribers: { $push: "$subscribers" },
        totalSubscribers: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        subscribers: {
          _id: 1,
          fullName: 1,
          userName: 1,
          avatar: 1,
        },
        subscribersCount: "$totalSubscribers",
      },
    },
  ]);

  if (!subscribers) throw new ApiError(404, "No subscribers found");

  return res
    .status(200)
    .json(
      new ApiResponse(200, subscribers, "Subscribers fetched successfully")
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
                      "$subscibers.subscriber",
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

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannel,
        "Channel Subscribed fetched successfully"
      )
    );
});

export { toggleSubscription, getSubscribedChannel, getUserChannelSubscriber };
