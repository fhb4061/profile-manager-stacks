import { aws_cognito, aws_dynamodb, aws_ecr, aws_iam, aws_lambda, aws_logs } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

type CognitoStackProps = cdk.StackProps & {
    prefix: string;
    callbackUrls: string[];
    logoutUrls: string[];
    lambdaRepository: aws_ecr.Repository;
    profileTable: aws_dynamodb.Table;
    postConfirmationCmd: string[];
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
                familyName: {
                    required: true,
                    mutable: true
                },
                givenName: {
                    required: true,
                    mutable: true
                }
            },
            userVerification: {
                emailStyle: aws_cognito.VerificationEmailStyle.CODE,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // post-confirmation trigger: creates the profile row so it exists by the time
        // the user lands on their profile page. Cognito invokes it synchronously (5s
        // timeout, 2 retries) — full vCPU memory keeps Java cold start under the limit.
        const postConfirmationLogGroup = new aws_logs.LogGroup(this, `${props.prefix}-post-confirmation-fn-log-group`, {
            retention: aws_logs.RetentionDays.ONE_DAY,
            logGroupName: `${props.prefix}-post-confirmation-fn-log-group`,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        const postConfirmationRole = new aws_iam.Role(this, `${props.prefix}-post-confirmation-fn-role`, {
            assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });

        const postConfirmationHandler = new aws_lambda.DockerImageFunction(this, `${props.prefix}-post-confirmation-fn`, {
            code: aws_lambda.DockerImageCode.fromEcr(props.lambdaRepository, {
                cmd: props.postConfirmationCmd,
                tagOrDigest: "sha256:0b92ee3d362b7c045199d5911a5782824223e28095350b296608ead9c37cd199"
            }),
            memorySize: 1769,
            environment: {
                PROFILE_TABLE: props.profileTable.tableName
            },
            logGroup: postConfirmationLogGroup,
            role: postConfirmationRole
        });

        postConfirmationRole.addToPolicy(new aws_iam.PolicyStatement({
            actions: ['dynamodb:PutItem'],
            resources: [props.profileTable.tableArn],
        }));

        userPool.addTrigger(aws_cognito.UserPoolOperation.POST_CONFIRMATION, postConfirmationHandler);

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
            description: 'Cognito user pool ID',
        });

        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: userPoolClient.userPoolClientId,
            description: 'App client ID used to build the Hosted UI login URL',
        });

        new cdk.CfnOutput(this, 'HostedUIDomain', {
            value: userPoolDomain.baseUrl(),
            description: 'Base URL of the Cognito Hosted UI login page',
        });

        new cdk.CfnOutput(this, 'PostConfirmationFunctionName', {
            value: postConfirmationHandler.functionName,
            description: 'Post-confirmation trigger Lambda, for manual invoke/log-tail/update-function-code',
        });
    }
}
