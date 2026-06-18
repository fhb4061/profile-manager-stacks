#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
// import { ECRStack } from '../lib/ecr-stack';
import { GithubRoleStack } from '../lib/github-role-stack';
import { BackendStack } from '../lib/backendStack';

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
const prefix = 'backend-profile';

// new ECRStack(app, 'ECRStack', {
//   env
//   /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
// });

new GithubRoleStack(app, 'GithubRoleStack', { env });

new BackendStack(app, "BackendStack", {
  env,
  prefix
})