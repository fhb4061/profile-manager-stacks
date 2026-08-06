import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { siteNameFromRepository, StaticSiteStack } from '../lib/static-site-stack';

describe('Static site name derivation', () => {
    test('derives pascal-case stack name from github repository', () => {
        expect(siteNameFromRepository('fhb4061/profile-blog')).toEqual({
            stackName: 'ProfileBlogStaticSite',
            resourcePrefix: 'profile-blog',
        });
    });

    test('rejects repos outside the profile-* naming convention', () => {
        expect(() => siteNameFromRepository('fhb4061/other-app')).toThrow(/profile-/);
    });
});

const app = new cdk.App();
const stack = new StaticSiteStack(app, 'MyTestStack', { repository: 'fhb4061/profile-blog' });
const template = Template.fromStack(stack);

describe('Static site stack test', () => {
    test('bucket is private, destroyable, and named profile-* so the CI sync policy can scope to it', () => {
        template.hasResource('AWS::S3::Bucket', {
            DeletionPolicy: 'Delete',
            UpdateReplacePolicy: 'Delete',
            Properties: {
                BucketName: 'profile-blog-static-site',
                PublicAccessBlockConfiguration: {
                    BlockPublicAcls: true,
                    BlockPublicPolicy: true,
                    IgnorePublicAcls: true,
                    RestrictPublicBuckets: true,
                },
            },
        });
    });

    test('CloudFront serves the bucket via Origin Access Control, HTTPS only', () => {
        template.resourceCountIs('AWS::CloudFront::Distribution', 1);
        template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
            OriginAccessControlConfig: Match.objectLike({
                OriginAccessControlOriginType: 's3',
                SigningBehavior: 'always',
            }),
        });
        template.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: Match.objectLike({
                DefaultCacheBehavior: Match.objectLike({
                    ViewerProtocolPolicy: 'redirect-to-https',
                }),
            }),
        });
    });

    test('serves index.html at the root and for unknown paths (client-side routing)', () => {
        template.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: Match.objectLike({
                DefaultRootObject: 'index.html',
                CustomErrorResponses: Match.arrayWith([
                    Match.objectLike({ ErrorCode: 403, ResponseCode: 200, ResponsePagePath: '/index.html' }),
                    Match.objectLike({ ErrorCode: 404, ResponseCode: 200, ResponsePagePath: '/index.html' }),
                ]),
            }),
        });
    });

    test('outputs expose bucket, distribution id, and site URL for the deploy workflow', () => {
        template.hasOutput('BucketName', {});
        template.hasOutput('DistributionId', {});
        template.hasOutput('DistributionDomain', {});
    });
});
