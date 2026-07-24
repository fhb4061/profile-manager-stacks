import { aws_cloudfront, aws_cloudfront_origins, aws_dynamodb, aws_ecr, aws_iam, aws_lambda, aws_logs, aws_s3, aws_s3_notifications } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

type PhotoStackProps = cdk.StackProps & {
    prefix: string;
    lambdaRepository: aws_ecr.Repository;
    profileTable: aws_dynamodb.Table;
    // TODO: replace with the real handler class once it exists in the Java backend repo
    photoValidationCmd: string[];
}

export class PhotoStack extends cdk.Stack {
    public readonly bucket: aws_s3.Bucket;
    public readonly distribution: aws_cloudfront.Distribution;
    public readonly validationHandler: aws_lambda.DockerImageFunction;

    constructor(scope: Construct, id: string, props: PhotoStackProps) {
        super(scope, id, props);

        this.bucket = new aws_s3.Bucket(this, `${props.prefix}-photo-bucket`, {
            blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        this.distribution = new aws_cloudfront.Distribution(this, `${props.prefix}-photo-distribution`, {
            defaultBehavior: {
                origin: aws_cloudfront_origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
            },
        });

        const validationFnLogGroup = new aws_logs.LogGroup(this, `${props.prefix}-photo-validation-fn-log-group`, {
            retention: aws_logs.RetentionDays.ONE_DAY,
            logGroupName: `${props.prefix}-photo-validation-fn-log-group`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        const validationHandlerRole = new aws_iam.Role(this, `${props.prefix}-photo-validation-fn-role`, {
            assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });

        this.validationHandler = new aws_lambda.DockerImageFunction(this, `${props.prefix}-photo-validation-fn`, {
            code: aws_lambda.DockerImageCode.fromEcr(props.lambdaRepository, {
                cmd: props.photoValidationCmd,
                tagOrDigest: "sha256:0b92ee3d362b7c045199d5911a5782824223e28095350b296608ead9c37cd199"
            }),
            memorySize: 1024,
            timeout: cdk.Duration.seconds(10),
            environment: {
                PROFILE_TABLE: props.profileTable.tableName,
                PHOTO_BUCKET: this.bucket.bucketName,
            },
            logGroup: validationFnLogGroup,
            role: validationHandlerRole,
        });

        // reads/overwrites the caller's own profile row; never creates or scans
        validationHandlerRole.addToPolicy(new aws_iam.PolicyStatement({
            actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
            resources: [props.profileTable.tableArn],
        }));

        this.bucket.grantRead(validationHandlerRole);
        this.bucket.grantDelete(validationHandlerRole);

        this.bucket.addEventNotification(
            aws_s3.EventType.OBJECT_CREATED,
            new aws_s3_notifications.LambdaDestination(this.validationHandler),
            { prefix: 'photos/' },
        );
    }
}
