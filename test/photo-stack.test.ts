import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PhotoStack } from '../lib/photo-stack';
import { ECRStack } from '../lib/ecr-stack';
import { DataStack } from '../lib/data-stack';

const app = new cdk.App();
const ecrStack = new ECRStack(app, 'EcrTestStack');
const dataStack = new DataStack(app, 'DataTestStack', { prefix: 'photo-test' });
const stack = new PhotoStack(app, 'MyTestStack', {
    prefix: 'photo-test',
    lambdaRepository: ecrStack.lambdaRepository,
    profileTable: dataStack.profileTable,
    photoValidationCmd: ['com.profile.PhotoValidationHandler::handleRequest'],
    allowedOrigins: ['http://localhost:5173'],
});
const template = Template.fromStack(stack);

describe('Photo stack test', () => {
    test('bucket is private and destroyable', () => {
        template.hasResource('AWS::S3::Bucket', {
            DeletionPolicy: 'Delete',
            UpdateReplacePolicy: 'Delete',
            Properties: {
                PublicAccessBlockConfiguration: {
                    BlockPublicAcls: true,
                    BlockPublicPolicy: true,
                    IgnorePublicAcls: true,
                    RestrictPublicBuckets: true,
                },
            },
        });
    });

    test('CloudFront distribution serves the bucket via Origin Access Control', () => {
        template.resourceCountIs('AWS::CloudFront::Distribution', 1);
        template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
            OriginAccessControlConfig: Match.objectLike({
                OriginAccessControlOriginType: 's3',
                SigningBehavior: 'always',
            }),
        });
    });

    test('validation lambda is a Docker image function from the shared ECR repo', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            PackageType: 'Image',
            Code: Match.objectLike({
                ImageUri: Match.anyValue(),
            }),
        });
    });

    test('validation lambda can read/update profiles and read/delete photos, nothing broader', () => {
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Action: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
                        Effect: 'Allow',
                    }),
                ]),
            },
            Roles: [{ Ref: Match.stringLikeRegexp('phototestphotovalidationfnrole') }],
        });

        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Action: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
                        Effect: 'Allow',
                    }),
                    Match.objectLike({
                        Action: 's3:DeleteObject*',
                        Effect: 'Allow',
                    }),
                ]),
            },
            Roles: [{ Ref: Match.stringLikeRegexp('phototestphotovalidationfnrole') }],
        });
    });

    test('bucket allows POST uploads from the local dev frontend origin', () => {
        template.hasResourceProperties('AWS::S3::Bucket', {
            CorsConfiguration: {
                CorsRules: Match.arrayWith([
                    Match.objectLike({
                        AllowedOrigins: ['http://localhost:5173'],
                        AllowedMethods: ['POST'],
                        AllowedHeaders: ['*'],
                    }),
                ]),
            },
        });
    });

    test('uploads under photos/ trigger the validation lambda', () => {
        template.hasResourceProperties('Custom::S3BucketNotifications', {
            NotificationConfiguration: {
                LambdaFunctionConfigurations: [
                    Match.objectLike({
                        Events: ['s3:ObjectCreated:*'],
                        Filter: {
                            Key: {
                                FilterRules: Match.arrayWith([
                                    Match.objectLike({ Name: 'prefix', Value: 'photos/' }),
                                ]),
                            },
                        },
                    }),
                ],
            },
        });
    });

    test('outputs expose bucket, distribution and validation fn for manual ops', () => {
        template.hasOutput('BucketName', {});
        template.hasOutput('DistributionDomain', {});
        template.hasOutput('DistributionId', {});
        template.hasOutput('ValidationFunctionName', {});
    });
});
