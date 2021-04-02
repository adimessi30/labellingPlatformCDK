const fs = require("fs");
const serviceAccountLocalPath = "./serviceAccountKey.json";

const downloadFile = async (bucketName, key, destPath) => {
  console.log("Downloading serviceAccountKey.json....");
  const aws_sdk = require("aws-sdk");
  const s3Client = new aws_sdk.S3();
  const params = {
    Bucket: bucketName,
    Key: key,
  };
  const s3Object = s3Client.getObject(params);
  s3Object.promise().then(({ Body }) => {
    fs.writeFileSync(destPath, Body);
    console.log("Downloaded serviceAccountKey.json....");
  });
};

if (!fs.existsSync(serviceAccountLocalPath)) {
  const serviceAccountBucket =
    "labellingplatformcdkstac-labellingplatformresourc-qz65hswvkznk";
  const serviceAccountKeyPath = "credentials/serviceAccountKey.json";
  downloadFile(
    serviceAccountBucket,
    serviceAccountKeyPath,
    serviceAccountLocalPath
  );
} else {
  console.log("serviceAccountKey.json already exists....");
}
console.log("File exists ? = ", fs.existsSync(destPath));
