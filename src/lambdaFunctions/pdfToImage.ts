import { readFileSync, readdirSync, writeFileSync } from "fs";

import { S3 } from "aws-sdk";
import { S3Event } from "aws-lambda";
import { execSync } from "child_process";

const s3 = new S3();
const ghostScriptPDF = async (inputFile: string, outputFilePrefix: string) => {
  execSync(
    `/opt/bin/gs -sDEVICE=jpeg -r288 -o '/tmp/${outputFilePrefix}_%d.jpg' ${inputFile}`
  );
};

const uploadToS3 = async (bucket: string, key: string, body: S3.Body) =>
  s3
    .upload({
      Bucket: bucket,
      Key: key,
      Body: body,
    })
    .promise();

exports.handler = async (event: S3Event) => {
  const srcBucket = event.Records[0].s3.bucket.name;
  const srcKey = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  const params = {
    Bucket: srcBucket,
    Key: srcKey,
  };
  const pdfFileName = srcKey.split("/").pop();
  const pdfFilePath = "/tmp/" + pdfFileName;
  const outputPrefix = pdfFileName!.replace(".pdf", "");
  const data = await s3.getObject(params).promise();
  writeFileSync(pdfFilePath, data.Body);
  await ghostScriptPDF(pdfFilePath, outputPrefix);
  const outputFiles = readdirSync("/tmp/").filter(
    (file) => file.startsWith(outputPrefix) && file.endsWith(".jpg")
  );
  const pages = outputFiles.length;
  const promises = outputFiles.map(async (file, fileIndex) =>
    uploadToS3(
      srcBucket,
      `imageFiles/${outputPrefix}_${fileIndex}_${pages}.jpg`,
      readFileSync(`/tmp/${file}`)
    )
  );
  await Promise.all(promises).then((uploadResponses) => {
    console.log(
      `Uploaded ${pages} images to the below URLs:\n${uploadResponses
        .map((uploadResponse) => uploadResponse.Location)
        .join("\n")}`
    );
  });
};
