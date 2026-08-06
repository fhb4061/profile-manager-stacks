#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ECRStack } from '../lib/ecr-stack';
import { GithubRoleStack } from '../lib/github-role-stack';
import { BackendStack } from '../lib/backend-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { CognitoStack } from '../lib/cognito-stack';
import { DataStack } from '../lib/data-stack';
import { PhotoStack } from '../lib/photo-stack';

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
const prefix = 'profile';

// TODO: replace with the frontend's real domain once one exists (Cognito requires HTTPS callbacks except localhost)
// single source of truth: every stack's CORS/callback config derives from this list
const frontendOrigins = ['http://localhost:5173'];

new GithubRoleStack(app, 'GithubRoleStack', {
  env,
  description: "Stack includes policy statements and roles needed for my github action workflows to access AWS resources"
});

const ecr = new ECRStack(app, 'ECRStack', {
  env,
  description: "Stack includes all repositories needed for my fullstack application"
});

const data = new DataStack(app, 'DataStack', {
  env,
  prefix,
  description: "Stack includes DynamoDB creation needed for my fullstack application to persist user profile data"
});

const cognito = new CognitoStack(app, 'CognitoStack', {
  env,
  prefix,
  callbackUrls: frontendOrigins.flatMap((o) => [`${o}/`, `${o}/callback`]),
  logoutUrls: frontendOrigins.flatMap((o) => [`${o}/`, `${o}/login`]),
  lambdaRepository: ecr.lambdaRepository,
  profileTable: data.profileTable,
  description: "Stack includes Cognito user pool/client for my frontend to authenticate with, plus a post-confirmation Lambda that creates the profile row on signup",
  // TODO: replace with the real handler class once it exists in the Java backend repo
  postConfirmationCmd: ['com.profile.PostConfirmationHandler::handleRequest'],
});

const photo = new PhotoStack(app, 'PhotoStack', {
  env,
  prefix,
  lambdaRepository: ecr.lambdaRepository,
  profileTable: data.profileTable,
  description: "Stack includes S3 bucket for user profile photos, served through CloudFront, with a validation Lambda triggered on upload",
  // TODO: replace with the real handler class once it exists in the Java backend repo
  photoValidationCmd: ['com.profile.PhotoValidationHandler::handleRequest'],
  allowedOrigins: frontendOrigins,
});

new BackendStack(app, "BackendStack", {
  env,
  prefix,
  lambdaRepository: ecr.lambdaRepository,
  userPool: cognito.userPool,
  profileTable: data.profileTable,
  photoBucket: photo.bucket,
  cloudFrontDomain: photo.distribution.distributionDomainName,
  allowedOrigins: frontendOrigins,
  description: "Stack includes API Gateway and a lambda function that reads/updates the caller's profile, lists other users' public profiles, and issues presigned photo upload URLs",
});

new FrontendStack(app, "FrontendStack", {
  env,
  prefix,
  description: "Stack includes S3 bucket and CloudFront distribution as the deploy target for the frontend app, built assets synced in by CI"
});