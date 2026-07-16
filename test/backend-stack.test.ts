import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { BackendStack } from '../lib/backend-stack';
import { ECRStack } from '../lib/ecr-stack';
import { DataStack } from '../lib/data-stack';
import { CognitoStack } from '../lib/cognito-stack';

const app = new cdk.App();
const ecrStack = new ECRStack(app, 'EcrTestStack');
const dataStack = new DataStack(app, 'DataTestStack', { prefix: 'backend-test' });
const cognitoStack = new CognitoStack(app, 'CognitoTestStack', {
    prefix: 'backend-test',
    callbackUrls: ['http://localhost:3000/callback'],
    logoutUrls: ['http://localhost:3000'],
    lambdaRepository: ecrStack.lambdaRepository,
    profileTable: dataStack.profileTable,
    postConfirmationCmd: ['com.profile.PostConfirmationHandler::handleRequest'],
});
const stack = new BackendStack(app, 'MyTestStack', {
    prefix: 'backend-test',
    lambdaRepository: ecrStack.lambdaRepository,
    userPool: cognitoStack.userPool,
    profileTable: dataStack.profileTable,
});
const template = Template.fromStack(stack);

describe('REST API stack test', () => {
    test('lambda function and log group created', () => {
        template.hasResource('AWS::Logs::LogGroup', {
            DeletionPolicy: 'Delete',
            UpdateReplacePolicy: 'Delete',
            Properties: {
                RetentionInDays: 1,
                LogGroupName: 'backend-test-fn-log-group',
            },
        });

        template.hasResourceProperties('AWS::Lambda::Function', {
            PackageType: 'Image',
            Code: Match.objectLike({
                ImageUri: Match.anyValue(),
            }),
        });
    });

    test('REST API Gateway created with access logging', () => {
        template.hasResource('AWS::Logs::LogGroup', {
            DeletionPolicy: 'Delete',
            UpdateReplacePolicy: 'Delete',
            Properties: {
                RetentionInDays: 1,
                LogGroupName: 'backend-test-apigw-log-group',
            },
        });

        template.hasResource('AWS::ApiGateway::RestApi', {
            Properties: {
                Name: 'backend-test-profile-service',
            },
        });
    });

    test('owns no DynamoDB table (table lives in DataStack)', () => {
        template.resourceCountIs('AWS::DynamoDB::Table', 0);
    });

    test('exposes /profile, /profiles and /profiles/{sub} resources', () => {
        template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: 'profile' });
        template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: 'profiles' });
        template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: '{sub}' });
    });

    test('own profile is readable and editable, others only readable, nothing is creatable or deletable', () => {
        // GET /profile, GET /profiles, GET /profiles/{sub}
        template.resourcePropertiesCountIs('AWS::ApiGateway::Method', { HttpMethod: 'GET' }, 3);
        // PUT /profile
        template.resourcePropertiesCountIs('AWS::ApiGateway::Method', { HttpMethod: 'PUT' }, 1);
        // profile creation is the post-confirmation trigger's job now
        template.resourcePropertiesCountIs('AWS::ApiGateway::Method', { HttpMethod: 'POST' }, 0);
        template.resourcePropertiesCountIs('AWS::ApiGateway::Method', { HttpMethod: 'DELETE' }, 0);
    });

    test('API fn can read, write and list profiles but never create-via-API or delete', () => {
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: [
                    Match.objectLike({
                        Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Scan'],
                        Effect: 'Allow',
                    }),
                ],
            },
            Roles: [{ Ref: Match.stringLikeRegexp('backendtestfnrole') }],
        });
    });

    test('stage throttles runaway clients', () => {
        template.hasResourceProperties('AWS::ApiGateway::Stage', {
            MethodSettings: [
                Match.objectLike({
                    HttpMethod: '*',
                    ResourcePath: '/*',
                    ThrottlingRateLimit: 50,
                    ThrottlingBurstLimit: 100,
                }),
            ],
        });
    });

    test('output exposes API fn name so backend CI can update its code', () => {
        template.hasOutput('ApiFunctionName', {});
    });

    test('every method requires Cognito auth and proxies to the lambda', () => {
        template.resourceCountIs('AWS::ApiGateway::Authorizer', 1);
        const methods = template.findResources('AWS::ApiGateway::Method');
        const methodProps = Object.values(methods).map((m) => m.Properties);
        expect(methodProps.length).toBe(4);
        for (const props of methodProps) {
            expect(props.AuthorizationType).toBe('COGNITO_USER_POOLS');
            expect(props.Integration.Type).toBe('AWS_PROXY');
        }
    });
});
