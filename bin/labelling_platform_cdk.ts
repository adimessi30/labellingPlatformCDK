#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LabellingPlatformCdkStack } from '../lib/labelling_platform_cdk-stack';

const app = new cdk.App();
new LabellingPlatformCdkStack(app, 'LabellingPlatformCdkStack');
