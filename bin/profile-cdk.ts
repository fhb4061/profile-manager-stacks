#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ECRStack } from '../lib/ecr-stack';
import { GithubRoleStack } from '../lib/github-role-stack';
import { BackendStack } from '../lib/backendStack';
import { ECSStack } from '../lib/ecs-stack';

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
const prefix = 'backend-profile';

new GithubRoleStack(app, 'GithubRoleStack', { env });

const ecr = new ECRStack(app, 'ECRStack', { env });
new ECSStack(app, "ECSStack", { env, repository: ecr.repository });

new BackendStack(app, "BackendStack", {
  env,
  prefix
});