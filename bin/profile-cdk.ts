#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ECRStack } from '../lib/ecr-stack';
import { GithubRoleStack } from '../lib/github-role-stack';
import { BackendStack } from '../lib/backend-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { CognitoStack } from '../lib/cognito-stack';

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
const prefix = 'profile';

new GithubRoleStack(app, 'GithubRoleStack', { env });

const ecr = new ECRStack(app, 'ECRStack', { env });

// TODO: replace with the frontend's real domain once one exists (Cognito requires HTTPS callbacks except localhost)
const cognito = new CognitoStack(app, 'CognitoStack', {
  env,
  prefix,
  callbackUrls: ['http://localhost:3000/callback'],
  logoutUrls: ['http://localhost:3000'],
});

new BackendStack(app, "BackendStack", {
  env,
  prefix,
  lambdaRepository: ecr.lambdaRepository,
  userPool: cognito.userPool
});

new FrontendStack(app, "FrontendStack", { env, repository: ecr.repository });