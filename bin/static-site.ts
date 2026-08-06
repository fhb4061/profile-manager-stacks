#!/usr/bin/env node
// entrypoint for the reusable static-site workflow; not part of the main app (bin/profile-cdk.ts).
// invoked as: cdk deploy --app "npx ts-node bin/static-site.ts" -c repository=$GITHUB_REPOSITORY
import * as cdk from 'aws-cdk-lib/core';
import { siteNameFromRepository, StaticSiteStack } from '../lib/static-site-stack';

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }

const repository = app.node.getContext('repository');
const { stackName } = siteNameFromRepository(repository);

new StaticSiteStack(app, stackName, {
    env,
    repository,
    description: `Static site (S3 + CloudFront) provisioned by the reusable workflow for ${repository}`,
});
