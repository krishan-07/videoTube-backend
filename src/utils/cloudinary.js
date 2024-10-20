import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    //upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // file has been uploaded successfully
    // console.log("file has been uploaded succesfully", response);
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); //remove the locally saved temporary file as the upload operation got failed
    return null;
  }
};

const extractPublicIdFromUrl = (url) => {
  const parts = url.split("/");
  const uploadIndex = parts.indexOf("upload");
  const publicIdWithExtension = parts.slice(uploadIndex + 2)[0];
  const publicId = publicIdWithExtension.split(".")[0];

  return publicId;
};

const removeFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    if (!publicId) return null;

    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return response;
  } catch (error) {
    throw new Error(error.message);
  }
};

const removeLocalFile = (file1, file2) => {
  if (file1) fs.unlinkSync(file1);
  if (file2) fs.unlinkSync(file2);
};

export {
  uploadOnCloudinary,
  extractPublicIdFromUrl,
  removeFromCloudinary,
  removeLocalFile,
};
