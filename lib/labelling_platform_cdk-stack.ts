import { Bucket, CorsRule, EventType, HttpMethods } from "@aws-cdk/aws-s3";
import { Code, Function, LayerVersion, Runtime } from "@aws-cdk/aws-lambda";
import { Construct, Duration, Stack, StackProps } from "@aws-cdk/core";
import {
  S3EventSource,
  S3EventSourceProps,
} from "@aws-cdk/aws-lambda-event-sources";

import { Asset } from "@aws-cdk/aws-s3-assets";
import { NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";

export class LabellingPlatformCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucket = new Bucket(this, "labelling-platform-resources");
    const corsRule: CorsRule = {
      allowedHeaders: ["*"],
      allowedMethods: [
        HttpMethods.GET,
        HttpMethods.HEAD,
        HttpMethods.PUT,
        HttpMethods.POST,
      ],
      allowedOrigins: [
        "http://localhost:3000",
        "https://labellingplatform.web.app",
      ],
      exposedHeaders: ["Etag"],
    };
    bucket.addCorsRule(corsRule);
    const pdfUploadEventSourceProps: S3EventSourceProps = {
      events: [EventType.OBJECT_CREATED],
      filters: [{ prefix: "pdfFiles/", suffix: ".pdf" }],
    };
    const imageCreateEventSourceProps: S3EventSourceProps = {
      events: [EventType.OBJECT_CREATED],
      filters: [{ prefix: "imageFiles/", suffix: ".jpg" }],
    };
    const pdfUploadEventSource = new S3EventSource(
      bucket,
      pdfUploadEventSourceProps
    );
    const imageCreateEventSource = new S3EventSource(
      bucket,
      imageCreateEventSourceProps
    );

    const ghostScriptLayer = LayerVersion.fromLayerVersionArn(
      this,
      "GhostScriptLambdaLayer",
      "arn:aws:lambda:us-east-1:764866452798:layer:ghostscript:8"
    );

    const tesseractJsLayer = LayerVersion.fromLayerVersionArn(
      this,
      "TesseractJsLambdaLayer",
      "arn:aws:lambda:us-east-1:794330213412:layer:tesseract-js:1"
    );

    const firebaseAdminLayer = LayerVersion.fromLayerVersionArn(
      this,
      "FirebaseAdminLayer",
      "arn:aws:lambda:us-east-1:794330213412:layer:firebase-admin:1"
    );

    const firebaseServiceAccountKey = new Asset(
      this,
      "FirebaseServiceAccountKey",
      {
        path: "./serviceAccountKey.json",
      }
    );

    const tesseractAssets = new Asset(this, "TesseractAssets", {
      path: "./src/tesseractAssets/eng.traineddata",
    });

    const pdfToImageHandler = new Function(this, "PdfToImageHandler", {
      runtime: Runtime.NODEJS_10_X,
      layers: [ghostScriptLayer],
      handler: "pdfToImage.handler",
      code: Code.fromAsset("./src/lambdaFunctions"),
      timeout: Duration.minutes(5),
      retryAttempts: 0,
      description:
        "This lambda converts PDF files to images for each of the pages found in the PDF",
      memorySize: 10240,
    });
    pdfToImageHandler.addEventSource(pdfUploadEventSource);

    const imageToTextHandler = new NodejsFunction(this, "ImageToTextHandler", {
      entry: "./src/lambdaFunctions/imageToText.ts",
      layers: [tesseractJsLayer, firebaseAdminLayer],
      handler: "handler",
      runtime: Runtime.NODEJS_14_X,
      timeout: Duration.minutes(5),
      retryAttempts: 0,
      description: "This lambda converts image files to text files",
      memorySize: 10240,
      environment: {
        FIREBASE_SERVICE_ACCOUNT_BUCKET_NAME:
          firebaseServiceAccountKey.s3BucketName,
        FIREBASE_SERVICE_ACCOUNT_KEY: firebaseServiceAccountKey.s3ObjectKey,
        TESSERACT_MODEL_BUCKET_NAME: tesseractAssets.s3BucketName,
        TESSERACT_MODEL_KEY: tesseractAssets.s3ObjectKey,
      },
    });
    imageToTextHandler.addEventSource(imageCreateEventSource);

    [pdfToImageHandler, imageToTextHandler].forEach((resource) =>
      bucket.grantReadWrite(resource)
    );
    firebaseServiceAccountKey.grantRead(imageToTextHandler);
    tesseractAssets.grantRead(imageToTextHandler);
  }
}
