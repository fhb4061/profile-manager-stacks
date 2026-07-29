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

new GithubRoleStack(app, 'GithubRoleStack', { env });

const ecr = new ECRStack(app, 'ECRStack', { env });

const data = new DataStack(app, 'DataStack', { env, prefix });

const cognito = new CognitoStack(app, 'CognitoStack', {
  env,
  prefix,
  callbackUrls: frontendOrigins.flatMap((o) => [`${o}/`, `${o}/callback`]),
  logoutUrls: frontendOrigins.flatMap((o) => [`${o}/`, `${o}/login`]),
  lambdaRepository: ecr.lambdaRepository,
  profileTable: data.profileTable,
  // TODO: replace with the real handler class once it exists in the Java backend repo
  postConfirmationCmd: ['com.profile.PostConfirmationHandler::handleRequest'],
});

const photo = new PhotoStack(app, 'PhotoStack', {
  env,
  prefix,
  lambdaRepository: ecr.lambdaRepository,
  profileTable: data.profileTable,
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
});

new FrontendStack(app, "FrontendStack", { env, prefix });