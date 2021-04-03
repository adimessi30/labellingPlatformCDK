import * as LabellingPlatformCdk from "../lib/labelling_platform_cdk-stack";
import * as cdk from "@aws-cdk/core";

import {
  MatchStyle,
  expect as expectCDK,
  matchTemplate,
} from "@aws-cdk/assert";

test("Empty Stack", () => {
  const app = new cdk.App();
  // WHEN
  const stack = new LabellingPlatformCdk.LabellingPlatformCdkStack(
    app,
    "MyTestStack"
  );
  // THEN
  expectCDK(stack).to(
    matchTemplate(
      {
        Resources: {},
      },
      MatchStyle.EXACT
    )
  );
});
