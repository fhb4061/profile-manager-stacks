import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { BackendStack } from '../lib/backend-stack';
import { ECRStack } from '../lib/ecr-stack';
import { DataStack } from '../lib/data-stack';
import { CognitoStack } from '../lib/cognito-stack';
import { PhotoStack } from '../lib/photo-stack';

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
const photoStack = new PhotoStack(app, 'PhotoTestStack', {
    prefix: 'backend-test',
    lambdaRepository: ecrStack.lambdaRepository,
    profileTable: dataStack.profileTable,
    photoValidationCmd: ['com.profile.PhotoValidationHandler::handleRequest'],
});
const stack = new BackendStack(app, 'MyTestStack', {
    prefix: 'backend-test',
    lambdaRepository: ecrStack.lambdaRepository,
    userPool: cognitoStack.userPool,
    profileTable: dataStack.profileTable,
    photoBucket: photoStack.bucket,
    cloudFrontDomain: photoStack.distribution.distributionDomainName,
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

    test('exposes /profile, /profiles, /profiles/{sub} and /profile/photo resources', () => {
        template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: 'profile' });
        template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: 'profiles' });
        template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: '{sub}' });
        template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: 'photo' });
    });

    test('own profile is readable and editable, photo upload is requestable, nothing is deletable', () => {
        // GET /profile, GET /profiles, GET /profiles/{sub}
        template.resourcePropertiesCountIs('AWS::ApiGateway::Method', { HttpMethod: 'GET' }, 3);
        // PUT /profile
        template.resourcePropertiesCountIs('AWS::ApiGateway::Method', { HttpMethod: 'PUT' }, 1);
        // POST /profile/photo requests a presigned upload; profile creation is still the post-confirmation trigger's job
        template.resourcePropertiesCountIs('AWS::ApiGateway::Method', { HttpMethod: 'POST' }, 1);
        template.resourcePropertiesCountIs('AWS::ApiGateway::Method', { HttpMethod: 'DELETE' }, 0);
    });

    test('API fn can read, write and list profiles but never create-via-API or delete', () => {
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Scan'],
                        Effect: 'Allow',
                    }),
                ]),
            },
            Roles: [{ Ref: Match.stringLikeRegexp('backendtestfnrole') }],
        });
    });

    test('API fn can sign presigned uploads under photos/ but nothing broader on the bucket', () => {
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Action: 's3:PutObject',
                        Effect: 'Allow',
                        Resource: {
                            'Fn::Join': ['', Match.arrayWith(['/photos/*'])],
                        },
                    }),
                ]),
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

    test('API fn env vars let the handler sign uploads and build photo URLs', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            Environment: {
                Variables: Match.objectLike({
                    PHOTO_BUCKET: Match.anyValue(),
                    CLOUDFRONT_DOMAIN: Match.anyValue(),
                }),
            },
        });
    });

    test('output exposes API fn name so backend CI can update its code', () => {
        template.hasOutput('ApiFunctionName', {});
    });

    test('every non-preflight method requires Cognito auth and proxies to the lambda', () => {
        template.resourceCountIs('AWS::ApiGateway::Authorizer', 1);
        const methods = template.findResources('AWS::ApiGateway::Method');
        const methodProps = Object.values(methods)
            .map((m) => m.Properties)
            .filter((props) => props.HttpMethod !== 'OPTIONS');
        expect(methodProps.length).toBe(5);
        for (const props of methodProps) {
            expect(props.AuthorizationType).toBe('COGNITO_USER_POOLS');
            expect(props.Integration.Type).toBe('AWS_PROXY');
        }
    });
});
