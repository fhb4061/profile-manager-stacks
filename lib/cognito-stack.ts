import { aws_cognito } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

type CognitoStackProps = cdk.StackProps & {
    prefix: string;
    callbackUrls: string[];
    logoutUrls: string[];
}

export class CognitoStack extends cdk.Stack {
    public readonly userPool: aws_cognito.UserPool;
    public readonly userPoolDomain: aws_cognito.UserPoolDomain;

    constructor(scope: Construct, id: string, props: CognitoStackProps) {
        super(scope, id, props);

        // Cognito user pool
        const userPool = new aws_cognito.UserPool(this, `${props.prefix}-user-pool`, {
            userPoolName: `${props.prefix}-user-pool`,
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
            },
            autoVerify: {
                email: true,
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
            },
            userVerification: {
                emailStyle: aws_cognito.VerificationEmailStyle.CODE,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        const userPoolDomain = new aws_cognito.UserPoolDomain(this, `${props.prefix}-user-pool-domain`, {
            userPool,
            cognitoDomain: {
                domainPrefix: `${props.prefix}-${cdk.Aws.ACCOUNT_ID}`,
            },
        });

        const userPoolClient = new aws_cognito.UserPoolClient(this, `${props.prefix}-user-pool-client`, {
            userPool,
            userPoolClientName: "Profile manager",
            preventUserExistenceErrors: true,
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [
                    aws_cognito.OAuthScope.OPENID,
                    aws_cognito.OAuthScope.EMAIL,
                    aws_cognito.OAuthScope.PROFILE,
                ],
                callbackUrls: props.callbackUrls,
                logoutUrls: props.logoutUrls,
            },
        });

        this.userPool = userPool;
        this.userPoolDomain = userPoolDomain;

        new cdk.CfnOutput(this, 'UserPoolId', {
            value: userPool.userPoolId,
        });

        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: userPoolClient.userPoolClientId,
        });

        new cdk.CfnOutput(this, 'HostedUIDomain', {
            value: userPoolDomain.baseUrl(),
        });
    }
}
