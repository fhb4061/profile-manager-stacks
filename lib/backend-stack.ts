import { aws_apigateway, aws_cognito, aws_dynamodb, aws_ecr, aws_iam, aws_lambda, aws_logs } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

type ApiStackProps = cdk.StackProps & {
    prefix: string;
    lambdaRepository: aws_ecr.Repository;
    userPool: aws_cognito.UserPool;
}

export class BackendStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        // dynamoDB
        const profileTable = new aws_dynamodb.Table(this, `${props.prefix}-table`, {
            partitionKey: { name: 'sub', type: aws_dynamodb.AttributeType.STRING },
            tableName: `${props.prefix}-table`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

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

        // lambda function
        const profileHandler = new aws_lambda.DockerImageFunction(this, `${props.prefix}-fn`, {
            code: aws_lambda.DockerImageCode.fromEcr(props.lambdaRepository),
            environment: {
                PROFILE_TABLE: profileTable.tableName
            },
            logGroup: fnLogGroup,
            role: profileHandlerRole
        });

        // grant lambda permission to write to dynamoDB
        profileTable.grantReadWriteData(profileHandler);

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
            deployOptions: {
                metricsEnabled: true,
                dataTraceEnabled: false,
                accessLogDestination: new aws_apigateway.LogGroupLogDestination(apiGatewayLogGroup),
                accessLogFormat: aws_apigateway.AccessLogFormat.jsonWithStandardFields(),
                loggingLevel: aws_apigateway.MethodLoggingLevel.ERROR
            }
        });

        const authorizer = new aws_apigateway.CognitoUserPoolsAuthorizer(this, `${props.prefix}-authorizer`, {
            cognitoUserPools: [props.userPool],
        });

        const profile = api.root.addResource('profile');

        // create profile
        profile.addMethod("POST", new aws_apigateway.LambdaIntegration(profileHandler), {
            authorizer,
            authorizationType: aws_apigateway.AuthorizationType.COGNITO,
        });
    }
}
