import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import * as BackendStack from '../lib/backend-stack';

const app = new cdk.App();
const stack = new BackendStack.BackendStack(app, 'MyTestStack', { prefix: "backend-test" });
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
                        AttributeName: "username",
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

        // Lambda function
        template.hasResource("AWS::Lambda::Function", {
            // DependsOn: [], this has roles that is created automatically without me having to create it - should I do it myself?
            Properties: {
                Handler: "profile_handler.handler",
            }
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

        // console.log(template.toJSON());
    })
});
