import { aws_iam } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export class GithubRoleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // create Identity provider first
        const idProvider = new aws_iam.OidcProviderNative(this, "GithubProvider", {
            url: "https://token.actions.githubusercontent.com",
            clientIds: ["sts.amazonaws.com"]
        });


        // create new Role entrusted to idProvider with ECR permissions inlined
        const githubRole = new aws_iam.Role(this, "GithubRole", {
            roleName: "github-action-role",
            description: "Allow github action workflows to access certain AWS resources",
            assumedBy: new aws_iam.WebIdentityPrincipal(
                idProvider.openIdConnectProviderArn,
                {
                    StringEquals: {
                        "token.actions.githubusercontent.com:aud": ["sts.amazonaws.com"]
                    },
                    StringLike: {
                        "token.actions.githubusercontent.com:sub": "repo:fhb4061/profile-lambda:ref:refs/heads/master"
                    }
                }
            )
        });

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
            resources: [`arn:aws:ecr:${this.region}:${this.account}:repository/profile-*`]
        });

        // allow login into respository
        const authEcrStatement = new aws_iam.PolicyStatement({
            sid: 'ecrGlobalAccess',
            actions: [
                "ecr:GetAuthorizationToken",
            ],
            resources: ["*"]
        });

        githubRole.addToPolicy(ecrStatement);
        githubRole.addToPolicy(authEcrStatement);

        new cdk.CfnOutput(this, 'RoleArn', {
            value: githubRole.roleArn,
            description: 'Paste into GitHub Actions as the role-to-assume for OIDC login',
        });
    }
}
