import { aws_cognito } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

type CognitoStackProps = cdk.StackProps & {
    prefix: string;
}

export class CognitoStack extends cdk.Stack {
    public readonly userPool: aws_cognito.UserPool;

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

        new aws_cognito.UserPoolClient(this, `${props.prefix}-user-pool-client`, {
            userPool,
            userPoolClientName: "Profile maganer",
            preventUserExistenceErrors: true,
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
        });

        this.userPool = userPool;
    }
}
