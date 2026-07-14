import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { CognitoStack } from '../lib/cognito-stack';

const app = new cdk.App();
const stack = new CognitoStack(app, 'MyTestStack', {
    prefix: 'cognito-test',
    callbackUrls: ['http://localhost:3000/callback'],
    logoutUrls: ['http://localhost:3000'],
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
});
