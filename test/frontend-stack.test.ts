import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();
const stack = new FrontendStack(app, 'MyTestStack', { prefix: 'frontend-test' });
const template = Template.fromStack(stack);

describe('Frontend stack test', () => {
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

    test('serves index.html as the default root object', () => {
        template.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: Match.objectLike({
                DefaultRootObject: 'index.html',
            }),
        });
    });

    test('unknown paths fall back to index.html for client-side routing', () => {
        template.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: Match.objectLike({
                CustomErrorResponses: Match.arrayWith([
                    Match.objectLike({ ErrorCode: 403, ResponseCode: 200, ResponsePagePath: '/index.html' }),
                    Match.objectLike({ ErrorCode: 404, ResponseCode: 200, ResponsePagePath: '/index.html' }),
                ]),
            }),
        });
    });

    test('outputs expose bucket and distribution for the deploy pipeline', () => {
        template.hasOutput('BucketName', {});
        template.hasOutput('DistributionId', {});
        template.hasOutput('DistributionDomain', {});
    });
});
