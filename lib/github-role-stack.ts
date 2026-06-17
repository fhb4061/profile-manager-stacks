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

        // create role and entrust it to github idProvider
        const role = new aws_iam.Role(this, "GithubRole", {
            roleName: "github-action-role",
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

        // create policy statement
        const statement = new aws_iam.PolicyStatement({
            actions: [
                "ecr:DescribeImageScanFindings",
                "ecr:GetLifecyclePolicyPreview",
                "ecr:GetDownloadUrlForLayer",
                "ecr:DescribeImageReplicationStatus",
                "ecr:DescribeImageSigningStatus",
                "ecr:ListTagsForResource",
                "ecr:UploadLayerPart",
                "ecr:BatchGetRepositoryScanningConfiguration",
                "ecr:BatchImportUpstreamImage",
                "ecr:BatchGetImage",
                "ecr:CompleteLayerUpload",
                "ecr:TagResource",
                "ecr:DescribeRepositories",
                "ecr:GetImageCopyStatus",
                "ecr:InitiateLayerUpload",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetRepositoryPolicy",
                "ecr:GetLifecyclePolicy",
                "ecr:PutImage",
                "ecr:ValidatePullThroughCacheRule",
                "ecr:GetRegistryPolicy",
                "ecr:GetAccountSetting",
                "ecr:DescribeRegistry",
                "ecr:DescribeRepositoryCreationTemplates",
                "ecr:GetAuthorizationToken",
                "ecr:GetSigningConfiguration",
                "ecr:GetRegistryScanningConfiguration"
            ],
            resources: [`arn:aws:ecr:*:${process.env.CDK_DEFAULT_ACCOUNT}:repository/*`]
        });

        // create policy with statement and attach it to github-action-role
        new aws_iam.Policy(this, "GithubActionPolicy", {
            policyName: "github-action-policies",
            statements: [statement],
            roles: [role]
        })
    }
}
