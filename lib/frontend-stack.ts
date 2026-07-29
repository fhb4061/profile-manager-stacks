import { aws_cloudfront, aws_cloudfront_origins, aws_s3 } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

type FrontendStackProps = cdk.StackProps & {
    prefix: string;
}

export class FrontendStack extends cdk.Stack {
    public readonly bucket: aws_s3.Bucket;
    public readonly distribution: aws_cloudfront.Distribution;

    constructor(scope: Construct, id: string, props: FrontendStackProps) {
        super(scope, id, props);

        this.bucket = new aws_s3.Bucket(this, `${props.prefix}-frontend-bucket`, {
            blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        this.distribution = new aws_cloudfront.Distribution(this, `${props.prefix}-frontend-distribution`, {
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
            description: 'Frontend static site bucket (CFN-generated name) — deploy target for CI to sync built assets to',
        });

        new cdk.CfnOutput(this, 'DistributionId', {
            value: this.distribution.distributionId,
            description: 'For manual CloudFront invalidation after a deploy',
        });

        new cdk.CfnOutput(this, 'DistributionDomain', {
            value: this.distribution.distributionDomainName,
            description: 'CloudFront domain serving the frontend',
        });
    }
}
