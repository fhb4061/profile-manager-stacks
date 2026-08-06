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
                        "token.actions.githubusercontent.com:sub": "repo:fhb4061/profile-*:ref:refs/heads/master"
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

        // static-site workflow: sync built assets and invalidate the distribution after deploy
        githubRole.addToPolicy(new aws_iam.PolicyStatement({
            sid: 'staticSiteSync',
            actions: ["s3:ListBucket", "s3:PutObject", "s3:DeleteObject"],
            resources: ["arn:aws:s3:::profile-*", "arn:aws:s3:::profile-*/*"]
        }));

        githubRole.addToPolicy(new aws_iam.PolicyStatement({
            sid: 'staticSiteInvalidation',
            actions: ["cloudfront:CreateInvalidation"],
            resources: [`arn:aws:cloudfront::${this.account}:distribution/*`]
        }));

        new cdk.CfnOutput(this, 'RoleArn', {
            value: githubRole.roleArn,
            description: 'Paste into GitHub Actions as the role-to-assume for OIDC login',
        });

        // deploy role for the reusable static-site workflow: no direct resource permissions,
        // only assumes the CDK bootstrap roles (deploy/file-publishing/image-publishing/lookup)
        const deployRole = new aws_iam.Role(this, "GithubDeployRole", {
            roleName: "github-deploy-role",
            description: "Allow github action workflows to run cdk deploy via the CDK bootstrap roles",
            assumedBy: new aws_iam.WebIdentityPrincipal(
                idProvider.openIdConnectProviderArn,
                {
                    StringEquals: {
                        "token.actions.githubusercontent.com:aud": ["sts.amazonaws.com"]
                    },
                    StringLike: {
                        "token.actions.githubusercontent.com:sub": "repo:fhb4061/profile-*:ref:refs/heads/master"
                    }
                }
            )
        });

        deployRole.addToPolicy(new aws_iam.PolicyStatement({
            sid: 'assumeCdkBootstrapRoles',
            actions: ["sts:AssumeRole"],
            resources: [`arn:aws:iam::${this.account}:role/cdk-*`]
        }));

        new cdk.CfnOutput(this, 'DeployRoleArn', {
            value: deployRole.roleArn,
            description: 'role-to-assume for the reusable static-site workflow (cdk deploy)',
        });
    }
}
