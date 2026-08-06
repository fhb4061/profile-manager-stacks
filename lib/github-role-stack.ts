import { aws_iam } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export class GithubRoleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // statements for reading/writing images
        const ecrStatement = new aws_iam.PolicyStatement({
            sid: 'ecrRepoAccess',
            actions: [
                // ecr read permissions
                "ecr:BatchGetImage",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchCheckLayerAvailability",
                "ecr:DescribeRepositories",
                // ecr write permissions
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:PutImage"
            ],
            resources: [`arn:aws:ecr:*:${process.env.CDK_DEFAULT_ACCOUNT}:repository/*`]
        });

        // allow login into respository
        const authEcrStatement = new aws_iam.PolicyStatement({
            sid: 'ecrGlobalAccess',
            actions: [
                "ecr:GetAuthorizationToken",
            ],
            resources: ["*"]
        });

        // create managed policy
        const ecrManagedPolicy = new aws_iam.ManagedPolicy(this, "GithubActionPolicy", {
            managedPolicyName: "ecr-read-write-policy",
            description: "Allows read and write to any ECR in my account",
            statements: [ecrStatement, authEcrStatement]
        });

        // create Identity provider first
        const idProvider = new aws_iam.OidcProviderNative(this, "GithubProvider", {
            url: "https://token.actions.githubusercontent.com",
            clientIds: ["sts.amazonaws.com"]
        });


        // create new Role entrusted to idProvider with managed policies in place
        const githubRole = new aws_iam.Role(this, "GithubRole", {
            roleName: "github-action-role",
            description: "Allow github action workflows to access certain AWS resources",
            managedPolicies: [ecrManagedPolicy],
            assumedBy: new aws_iam.WebIdentityPrincipal(
                idProvider.openIdConnectProviderArn,
                {
                    StringEquals: {
                        "token.actions.githubusercontent.com:aud": ["sts.amazonaws.com"]
                    },
                    StringLike: {
                        "token.actions.githubusercontent.com:sub": [
                            "repo:fhb4061/*",
                            "repo:fhb4061/*"
                        ]
                    }
                }
            )
        });

        new cdk.CfnOutput(this, 'RoleArn', {
            value: githubRole.roleArn,
            description: 'Paste into GitHub Actions as the role-to-assume for OIDC login',
        });
    }
}
