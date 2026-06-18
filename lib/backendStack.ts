import { aws_apigateway, aws_dynamodb, aws_lambda, aws_logs } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import path from 'path';

type ApiStackProps = cdk.StackProps & {
    prefix: string;
}

export class BackendStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        // dynamoDB
        const profileTable = new aws_dynamodb.Table(this, `${props.prefix}-table`, {
            partitionKey: { name: 'username', type: aws_dynamodb.AttributeType.STRING },
            tableName: `${props.prefix}-table`,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        // Create log group for lambda function
        const fnLogGroup = new aws_logs.LogGroup(this, `${props.prefix}-fn-log-group`, {
            retention: aws_logs.RetentionDays.ONE_DAY
        });

        // lambda function
        const profileHandler = new aws_lambda.Function(this, `${props.prefix}-fn`, {
            runtime: aws_lambda.Runtime.NODEJS_20_X,
            handler: 'profile_handler.handler',
            code: aws_lambda.Code.fromAsset(path.join(__dirname, '../assets/lambda-functions')),
            environment: {
                PROFILE_TABLE: profileTable.tableName
            },
            logGroup: fnLogGroup
        });
        // grant lambda permission to write to dynamoDB
        profileTable.grantReadWriteData(profileHandler);

        // create log group for API Gateway
        const apiGatewayLogGroup = new aws_logs.LogGroup(this, `${props.prefix}-apigw-log-group`, {
            retention: aws_logs.RetentionDays.ONE_DAY
        });

        // API Gateway: Create a REST API with a lambda integration
        const api = new aws_apigateway.LambdaRestApi(this, `${props.prefix}-apigw`, {
            restApiName: `${props.prefix}-profile-service`,
            handler: profileHandler,
            proxy: false,
            cloudWatchRole: true,
            deployOptions: {
                metricsEnabled: true,
                dataTraceEnabled: true,
                accessLogDestination: new aws_apigateway.LogGroupLogDestination(apiGatewayLogGroup),
                accessLogFormat: aws_apigateway.AccessLogFormat.jsonWithStandardFields(),
                loggingLevel: aws_apigateway.MethodLoggingLevel.ERROR
            }
        });

        const profile = api.root.addResource('profile');

        // create profile
        profile.addMethod("POST", new aws_apigateway.LambdaIntegration(profileHandler, {
            proxy: false,
            requestParameters: {
                'integration.request.header.X-Amz-Invocation-Type': "'Event'"
            },
            requestTemplates: {
                'application/json': `{
                    "profileId": "$context.requestId",
                    "body": $input.json('$')
                }`
            },
            integrationResponses: [
                {
                    statusCode: '200',
                    responseTemplates: {
                        'application/json': `{"profileId": "$context.requetId"}`
                    }
                },
                {
                    statusCode: "500",
                    responseTemplates: {
                        'application/json': `{
                            "error": "An error occurred while processing the request.",
                            "details": "$context.integrationErrorMessage"
                        }`
                    }
                }
            ]
        }),
            {
                methodResponses: [{ statusCode: "200" }, { statusCode: "500" }]
            }
        );
    }
}
