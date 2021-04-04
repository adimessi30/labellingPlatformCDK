import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";

import { S3 } from "aws-sdk";

const s3Client = new S3();
const tesseractAssetPath = "/tmp/tesseractAssets";
const tesseractModelSuffix = "/eng.traineddata";

const downloadFile = async (
  bucketName: string,
  key: string,
  destPath: string
) => {
  const params = {
    Bucket: bucketName,
    Key: key,
  };
  const s3Object = s3Client.getObject(params);
  const data = await s3Object.promise();
  // @ts-ignore
  writeFileSync(destPath, data.Body!);
};

describe("Tesseract Assets", () => {
  beforeAll(() => {
    if (existsSync(tesseractAssetPath)) {
      rmSync(tesseractAssetPath, { recursive: true });
    }
  });
  afterAll(() => {
    if (existsSync(tesseractAssetPath)) {
      rmSync(tesseractAssetPath, { recursive: true });
    }
  });
  test("Should download trained data", async (done) => {
    mkdirSync(tesseractAssetPath);
    await downloadFile(
      "cdktoolkit-stagingbucket-16kc78fjkjrgb",
      "assets/debc8477af5c47ecc280f0f3b076c0e8883f2723fc41e9bce2416d189048c9d5.traineddata",
      tesseractAssetPath + tesseractModelSuffix
    );
    const downloadedFileBuffer = readFileSync(
      tesseractAssetPath + tesseractModelSuffix
    );
    const referenceFileBuffer = readFileSync(
      "./src/tesseractAssets/eng.traineddata"
    );
    expect(downloadedFileBuffer.equals(referenceFileBuffer)).toBeTruthy();
    done();
  });
});
