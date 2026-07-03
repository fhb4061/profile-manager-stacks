import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as BackendStack from '../lib/backend-stack';
import * as ECRStack from '../lib/ecr-stack';

const app = new cdk.App();
const ecrStack = new ECRStack.ECRStack(app, 'EcrTestStack');
const stack = new BackendStack.BackendStack(app, 'MyTestStack', { prefix: "backend-test", lambdaRepository: ecrStack.lambdaRepository });
const template = Template.fromStack(stack);

describe('REST API stack test', () => {
    test("DynamoDB created", () => {
        // DynamoDB
        template.hasResource("AWS::DynamoDB::Table", {
            UpdateReplacePolicy: "Delete",
            DeletionPolicy: "Delete",
            Properties: {
                TableName: "backend-test-table",
                KeySchema: [
                    {
                        AttributeName: "sub",
                        KeyType: "HASH"
                    }
                ],
            }
        });
    });

    test('Lambda function and log group created', () => {

        // Lambda log group
        template.hasResource("AWS::Logs::LogGroup", {
            DeletionPolicy: "Retain",
            UpdateReplacePolicy: "Retain",
            Properties: {
                RetentionInDays: 1,
                LogGroupName: "backend-test-fn-log-group"
            }
        });

        // Lambda execution role
        template.hasResourceProperties("AWS::IAM::Role", {
            AssumeRolePolicyDocument: {
                Statement: [
                    Match.objectLike({
                        Action: "sts:AssumeRole",
                        Principal: {
                            Service: "lambda.amazonaws.com"
                        }
                    })
                ]
            }
        });

        // Lambda function
        template.hasResourceProperties("AWS::Lambda::Function", {
            PackageType: "Image"
        });
        template.hasResourceProperties("AWS::Lambda::Function", {
            Code: Match.objectLike({
                ImageUri: Match.anyValue()
            })
        });
    });

    test("REST API Gateway created", () => {
        // API Gateway log group
        template.hasResource("AWS::Logs::LogGroup", {
            DeletionPolicy: "Retain",
            UpdateReplacePolicy: "Retain",
            Properties: {
                RetentionInDays: 1,
                LogGroupName: "backend-test-apigw-log-group"
            }
        });

        // RestApi Gateway
        template.hasResource("AWS::ApiGateway::RestApi", {
            Properties: {
                Name: "backend-test-profile-service"
            }
        });
    });

    test("Cognito auth is wired to POST /profile", () => {
        template.resourceCountIs("AWS::Cognito::UserPool", 1);
        template.resourceCountIs("AWS::Cognito::UserPoolClient", 1);
        template.resourceCountIs("AWS::ApiGateway::Authorizer", 1);
        template.hasResourceProperties("AWS::ApiGateway::Method", {
            HttpMethod: "POST",
            AuthorizationType: "COGNITO_USER_POOLS"
        });
    });

    test("POST /profile uses Lambda proxy integration", () => {
        template.hasResourceProperties("AWS::ApiGateway::Method", {
            HttpMethod: "POST",
            Integration: Match.objectLike({
                Type: "AWS_PROXY"
            })
        });
    });
});
