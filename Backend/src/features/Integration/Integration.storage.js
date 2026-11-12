import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import path from "node:path";

import cloudinary from "../../config/cloudinary.js";

export const uploadIntegrationSource = (file, projectId) => {
  return new Promise((resolve, reject) => {
    const extension = path.extname(file.originalname).toLowerCase();

    // Generate a unique filename for the uploaded source.
    const storageName = `${randomUUID()}${extension}`;

    // Specify the folder where the asset should appear in Media Library.
    const projectFolder = `corridorgate/${projectId}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        type: "authenticated",
        asset_folder: projectFolder,
        public_id: storageName,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result) {
          return reject(new Error("Cloudinary returned no upload result."));
        }

        resolve({
          assetId: result.asset_id,
          publicId: result.public_id,
          assetFolder: result.asset_folder,
          resourceType: result.resource_type,
          deliveryType: result.type,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );

    uploadStream.on("error", reject);

    Readable.from(file.buffer).pipe(uploadStream);
  });
};
export const deleteIntegrationSource = async (publicId) => {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "raw",
    type: "authenticated",
    invalidate: true,
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Cloudinary cleanup failed: ${result.result}`);
  }

  return result;
};
export const downloadIntegrationSource = async (source) => {
  if (
    source.resource_type !== "raw" ||
    source.delivery_type !== "authenticated"
  ) {
    throw new Error("Unsupported Cloudinary storage configuration.");
  }

  const extension = source.original_filename.split(".").pop().toLowerCase();

  const downloadUrl = cloudinary.utils.private_download_url(
    source.storage_public_id,
    extension,
    {
      resource_type: "raw",
      type: "authenticated",
      attachment: true,
    },
  );

  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(
      `Cloudinary download failed with status ${response.status}.`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error("The downloaded integration source is empty.");
  }

  return buffer;
};
