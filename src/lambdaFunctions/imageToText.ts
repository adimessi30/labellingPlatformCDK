import { mkdirSync, writeFileSync } from "fs";

import { Extract } from "unzipper";
import { S3 } from "aws-sdk";
import { S3Event } from "aws-lambda";
import dotenv from "dotenv";

dotenv.config();
const layerRootPath = "/opt/nodejs/node_modules";
const tesseractLayerPath = "/tesseract.js";
const firebaseAdminLayerPath = "/firebase-admin";
const admin = require(layerRootPath + firebaseAdminLayerPath);
const Tesseract = require(layerRootPath + tesseractLayerPath);

const s3Client = new S3();
const serviceAccountKeyPath = "/tmp/serviceAccountKey.json";
const tesseractAssetPath = "/tmp/tesseractAssets";
const tesseractModelSuffix = "/eng.traineddata";

const generateServiceAccountKeyFile = () => {
  const serviceAccountJson = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!, "base64").toString()
  );
  writeFileSync(serviceAccountKeyPath, JSON.stringify(serviceAccountJson));
};

const init = async () => {
  generateServiceAccountKeyFile();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKeyPath),
      storageBucket: "labellingplatform.appspot.com",
    });
  }
  mkdirSync(tesseractAssetPath);
  await downloadFile(
    process.env.TESSERACT_MODEL_BUCKET_NAME!,
    process.env.TESSERACT_MODEL_KEY!,
    tesseractAssetPath + tesseractModelSuffix
  );
};

const downloadFile = async (
  bucketName: string,
  key: string,
  destPath: string,
  isZip: boolean = false
) => {
  const params = {
    Bucket: bucketName,
    Key: key,
  };
  const s3Object = s3Client.getObject(params);

  if (isZip) {
    await s3Object
      .createReadStream()
      .pipe(Extract({ path: destPath }))
      .promise();
  } else {
    // @ts-ignore
    writeFileSync(destPath, (await s3Object.promise()).Body!);
  }
};

const fetchText = async (imagePath: string, lang: string): Promise<string> => {
  console.log("Processing image from:", imagePath);
  const {
    data: { text },
  } = await Tesseract.recognize(imagePath, lang, {
    langPath: tesseractAssetPath,
    cachePath: tesseractAssetPath,
    gzip: false,
  });
  return text;
};

exports.handler = async (event: S3Event) => {
  await init();
  const firebaseBucket = admin
    .storage()
    .bucket("labellingplatform.appspot.com");
  const artifactsCollection = admin.firestore().collection("Artifacts");
  const projectsCollection = admin.firestore().collection("Projects");
  for (const record of event.Records) {
    console.log("Processing record:", record);
    try {
      const srcBucket = record.s3.bucket.name;
      const srcKey = decodeURIComponent(
        record.s3.object.key.replace(/\+/g, " ")
      );
      const imageFileName = srcKey.split("/").pop();
      const imageFilePath = "/tmp/" + imageFileName;
      await downloadFile(srcBucket, srcKey, imageFilePath);
      const textContent = await fetchText(imageFilePath, "eng");
      const [
        projectId,
        artifactId,
        fileIndex,
        partitionsWithExtension,
      ] = imageFileName!.split("_");
      const partitions = partitionsWithExtension.replace(".jpg", "");
      const uploadFileName = `${artifactId}_${fileIndex}`;
      const textFilePath = imageFilePath.replace(".jpg", ".txt");
      writeFileSync(textFilePath, textContent);
      console.log(
        "Uploading text content to:",
        `${projectId}/${uploadFileName}.txt`
      );
      await firebaseBucket.upload(textFilePath, {
        destination: `${projectId}/${uploadFileName}.txt`,
        contentType: "text/plain",
      });
      console.log("Uploading image to:", `${projectId}/${uploadFileName}.jpg`);
      await firebaseBucket.upload(imageFilePath, {
        destination: `${projectId}/${uploadFileName}.jpg`,
        contentType: "image/jpeg",
      });
      if (parseInt(fileIndex) === parseInt(partitions) - 1) {
        console.log("Updating artifact:", artifactId);
        await artifactsCollection.doc(artifactId).update({
          partitions: parseInt(partitions),
        });
        console.log("Updating project:", projectId);
        await projectsCollection.doc(projectId).update({
          artifactIds: admin.firestore.FieldValue.arrayUnion(artifactId),
        });
      }
      console.log("Done processing record:", record);
    } catch (error) {
      console.log(error);
      return;
    }
  }
};
