import { aws_cloudfront, aws_cloudfront_origins, aws_s3 } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export type SiteName = {
    stackName: string;
    resourcePrefix: string;
}

// derives stack/resource names from the caller's github.repository ("owner/repo");
// enforces the profile-* convention the OIDC trust and IAM resource scoping rely on
export function siteNameFromRepository(repository: string): SiteName {
    const repo = repository.split('/')[1] ?? '';
    if (!repo.startsWith('profile-')) {
        throw new Error(`repository "${repository}" must be named profile-*`);
    }
    const pascal = repo.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    return {
        stackName: `${pascal}StaticSite`,
        resourcePrefix: repo,
    };
}

type StaticSiteStackProps = cdk.StackProps & {
    repository: string;
}

export class StaticSiteStack extends cdk.Stack {
    public readonly bucket: aws_s3.Bucket;
    public readonly distribution: aws_cloudfront.Distribution;

    constructor(scope: Construct, id: string, props: StaticSiteStackProps) {
        super(scope, id, props);

        const { resourcePrefix } = siteNameFromRepository(props.repository);

        // explicit profile-* name so github-action-role's s3 sync policy can scope to it
        this.bucket = new aws_s3.Bucket(this, `${resourcePrefix}-static-site-bucket`, {
            bucketName: `${resourcePrefix}-static-site`,
            blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        this.distribution = new aws_cloudfront.Distribution(this, `${resourcePrefix}-static-site-distribution`, {
            defaultBehavior: {
                origin: aws_cloudfront_origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
                viewerProtocolPolicy: aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            defaultRootObject: 'index.html',
            // SPA client-side routing: unknown paths still serve index.html instead of CloudFront's own 403/404
            errorResponses: [
                { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
                { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
            ],
        });

        new cdk.CfnOutput(this, 'BucketName', {
            value: this.bucket.bucketName,
            description: 'Static site bucket — deploy target for the workflow to sync built assets to',
        });

        new cdk.CfnOutput(this, 'DistributionId', {
            value: this.distribution.distributionId,
            description: 'For CloudFront invalidation after a sync',
        });

        new cdk.CfnOutput(this, 'DistributionDomain', {
            value: this.distribution.distributionDomainName,
            description: 'CloudFront domain serving the site',
        });
    }
}
