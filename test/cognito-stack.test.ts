import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CognitoStack } from '../lib/cognito-stack';
import { ECRStack } from '../lib/ecr-stack';
import { DataStack } from '../lib/data-stack';

const app = new cdk.App();
const ecrStack = new ECRStack(app, 'EcrTestStack');
const dataStack = new DataStack(app, 'DataTestStack', { prefix: 'cognito-test' });
const stack = new CognitoStack(app, 'MyTestStack', {
    prefix: 'cognito-test',
    callbackUrls: ['http://localhost:3000/callback'],
    logoutUrls: ['http://localhost:3000'],
    lambdaRepository: ecrStack.lambdaRepository,
    profileTable: dataStack.profileTable,
    postConfirmationCmd: ['com.profile.PostConfirmationHandler::handleRequest'],
});
const template = Template.fromStack(stack);

describe('Cognito stack test', () => {
    test('Hosted UI domain created', () => {
        template.resourceCountIs('AWS::Cognito::UserPoolDomain', 1);
    });

    test('User pool client configured for Hosted UI authorization-code flow', () => {
        template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
            AllowedOAuthFlows: ['code'],
            AllowedOAuthFlowsUserPoolClient: true,
            AllowedOAuthScopes: ['openid', 'email', 'profile'],
            CallbackURLs: ['http://localhost:3000/callback'],
            LogoutURLs: ['http://localhost:3000'],
        });
    });

    test('outputs expose IDs the frontend repo needs', () => {
        template.hasOutput('UserPoolId', {});
        template.hasOutput('UserPoolClientId', {});
        template.hasOutput('HostedUIDomain', {});
    });

    test('output exposes trigger fn name so backend CI can update its code', () => {
        template.hasOutput('PostConfirmationFunctionName', {});
    });

    test('post-confirmation trigger wired to the user pool', () => {
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            LambdaConfig: {
                PostConfirmation: Match.anyValue(),
            },
        });
    });

    test('trigger fn runs the post-confirmation handler with a full vCPU', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            PackageType: 'Image',
            MemorySize: 1769,
            ImageConfig: {
                Command: ['com.profile.PostConfirmationHandler::handleRequest'],
            },
            Environment: {
                Variables: {
                    PROFILE_TABLE: Match.anyValue(),
                },
            },
        });
    });

    test('trigger fn role can only PutItem on the profile table', () => {
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: [
                    Match.objectLike({
                        Action: 'dynamodb:PutItem',
                        Effect: 'Allow',
                    }),
                ],
            },
        });
    });
});
