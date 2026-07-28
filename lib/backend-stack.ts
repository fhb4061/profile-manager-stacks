import { aws_apigateway, aws_cognito, aws_dynamodb, aws_ecr, aws_iam, aws_lambda, aws_logs, aws_s3 } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

type ApiStackProps = cdk.StackProps & {
    prefix: string;
    lambdaRepository: aws_ecr.Repository;
    userPool: aws_cognito.UserPool;
    profileTable: aws_dynamodb.Table;
    photoBucket: aws_s3.Bucket;
    cloudFrontDomain: string;
}

export class BackendStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        // Create log group for lambda function
        const fnLogGroup = new aws_logs.LogGroup(this, `${props.prefix}-fn-log-group`, {
            retention: aws_logs.RetentionDays.ONE_DAY,
            logGroupName: `${props.prefix}-fn-log-group`,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        const profileHandlerRole = new aws_iam.Role(this, `${props.prefix}-fn-role`, {
            assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });

        // lambda function: single handler routing all /profile(s) endpoints internally
        const profileHandler = new aws_lambda.DockerImageFunction(this, `${props.prefix}-fn`, {
            code: aws_lambda.DockerImageCode.fromEcr(props.lambdaRepository, { tagOrDigest: "sha256:0b92ee3d362b7c045199d5911a5782824223e28095350b296608ead9c37cd199" }),
            memorySize: 512,
            timeout: cdk.Duration.seconds(10),
            environment: {
                PROFILE_TABLE: props.profileTable.tableName,
                PHOTO_BUCKET: props.photoBucket.bucketName,
                CLOUDFRONT_DOMAIN: props.cloudFrontDomain,
            },
            logGroup: fnLogGroup,
            role: profileHandlerRole
        });

        // least privilege: the API never creates or deletes rows
        profileHandlerRole.addToPolicy(new aws_iam.PolicyStatement({
            actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Scan'],
            resources: [props.profileTable.tableArn],
        }));

        // signs presigned POSTs; the POST's own conditions (exact key, content-type,
        // content-length-range) are what actually restrict a caller to their own sub
        profileHandlerRole.addToPolicy(new aws_iam.PolicyStatement({
            actions: ['s3:PutObject'],
            resources: [`${props.photoBucket.bucketArn}/photos/*`],
        }));

        // create log group for API Gateway
        const apiGatewayLogGroup = new aws_logs.LogGroup(this, `${props.prefix}-apigw-log-group`, {
            retention: aws_logs.RetentionDays.ONE_DAY,
            logGroupName: `${props.prefix}-apigw-log-group`,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        // API Gateway: Create a REST API with a lambda integration
        const api = new aws_apigateway.LambdaRestApi(this, `${props.prefix}-apigw`, {
            restApiName: `${props.prefix}-profile-service`,
            handler: profileHandler,
            proxy: false,
            cloudWatchRole: true,
            defaultCorsPreflightOptions: {
                allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
                allowMethods: aws_apigateway.Cors.ALL_METHODS,
                allowHeaders: aws_apigateway.Cors.DEFAULT_HEADERS,
            },
            deployOptions: {
                metricsEnabled: true,
                dataTraceEnabled: false,
                accessLogDestination: new aws_apigateway.LogGroupLogDestination(apiGatewayLogGroup),
                accessLogFormat: aws_apigateway.AccessLogFormat.jsonWithStandardFields(),
                loggingLevel: aws_apigateway.MethodLoggingLevel.ERROR,
                throttlingRateLimit: 50,
                throttlingBurstLimit: 100
            }
        });

        const authorizer = new aws_apigateway.CognitoUserPoolsAuthorizer(this, `${props.prefix}-authorizer`, {
            cognitoUserPools: [props.userPool],
        });

        const integration = new aws_apigateway.LambdaIntegration(profileHandler);
        const cognitoAuth = {
            authorizer,
            authorizationType: aws_apigateway.AuthorizationType.COGNITO,
        };

        // /profile: always the caller's own row (sub comes from the JWT, never the client)
        const profile = api.root.addResource('profile');
        profile.addMethod('GET', integration, cognitoAuth);
        profile.addMethod('PUT', integration, cognitoAuth);

        // /profiles: directory of public fields; /profiles/{sub}: another user's public fields
        const profiles = api.root.addResource('profiles');
        profiles.addMethod('GET', integration, cognitoAuth);
        const profileBySub = profiles.addResource('{sub}');
        profileBySub.addMethod('GET', integration, cognitoAuth);

        // /profile/photo: requests a presigned S3 POST scoped to the caller's own sub
        const profilePhoto = profile.addResource('photo');
        profilePhoto.addMethod('POST', integration, cognitoAuth);

        new cdk.CfnOutput(this, 'ApiFunctionName', {
            value: profileHandler.functionName,
        });
    }
}
