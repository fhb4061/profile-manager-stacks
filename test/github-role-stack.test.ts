import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as GithubRoleStack from '../lib/github-role-stack';

const app = new cdk.App();
const stack = new GithubRoleStack.GithubRoleStack(app, 'MyTestStack');
const template = Template.fromStack(stack);

describe("Github role, policy, and provider test", () => {

    test("Github role created", () => {
        template.hasResource("AWS::IAM::Role", {
            Properties: {
                RoleName: "github-action-role"
            }
        });
    });

    test("role can only be assumed by profile-* repos on master branch", () => {
        template.hasResourceProperties("AWS::IAM::Role", {
            AssumeRolePolicyDocument: {
                Statement: [
                    {
                        Action: "sts:AssumeRoleWithWebIdentity",
                        Condition: {
                            StringEquals: {
                                "token.actions.githubusercontent.com:aud": ["sts.amazonaws.com"]
                            },
                            StringLike: {
                                "token.actions.githubusercontent.com:sub": "repo:fhb4061/profile-*:ref:refs/heads/master"
                            }
                        }
                    }
                ]
            }
        });
    });

    test("Github OIDC provider created", () => {
        template.hasResource("AWS::IAM::OIDCProvider", {
            Properties: {
                ClientIdList: ["sts.amazonaws.com"],
                Url: "https://token.actions.githubusercontent.com"
            }
        });
    });

    test("ECR permissions are inlined on the role, no managed policy", () => {
        template.resourceCountIs("AWS::IAM::ManagedPolicy", 0);
        template.hasResourceProperties("AWS::IAM::Policy", {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Sid: "ecrRepoAccess",
                        Action: [
                            "ecr:BatchGetImage",
                            "ecr:GetDownloadUrlForLayer",
                            "ecr:BatchCheckLayerAvailability",
                            "ecr:DescribeRepositories",
                            "ecr:InitiateLayerUpload",
                            "ecr:UploadLayerPart",
                            "ecr:CompleteLayerUpload",
                            "ecr:PutImage"
                        ],
                        Effect: "Allow"
                    }),
                    Match.objectLike({
                        Sid: "ecrGlobalAccess",
                        Action: "ecr:GetAuthorizationToken",
                        Effect: "Allow",
                        Resource: "*"
                    })
                ])
            }
        });
    })

    test("ECR repo access is scoped to profile-* repos in the stack's region and account", () => {
        template.hasResourceProperties("AWS::IAM::Policy", {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Sid: "ecrRepoAccess",
                        Resource: {
                            "Fn::Join": ["", [
                                "arn:aws:ecr:",
                                { Ref: "AWS::Region" },
                                ":",
                                { Ref: "AWS::AccountId" },
                                ":repository/profile-*"
                            ]]
                        }
                    })
                ])
            }
        });
    });

    test("output exposes the role ARN for GitHub Actions workflow config", () => {
        template.hasOutput('RoleArn', {});
    })

    test("deploy role can only be assumed by profile-* repos on master branch", () => {
        template.hasResource("AWS::IAM::Role", {
            Properties: {
                RoleName: "github-deploy-role",
                AssumeRolePolicyDocument: {
                    Statement: [
                        {
                            Action: "sts:AssumeRoleWithWebIdentity",
                            Condition: {
                                StringEquals: {
                                    "token.actions.githubusercontent.com:aud": ["sts.amazonaws.com"]
                                },
                                StringLike: {
                                    "token.actions.githubusercontent.com:sub": "repo:fhb4061/profile-*:ref:refs/heads/master"
                                }
                            }
                        }
                    ]
                }
            }
        });
    });

    test("deploy role's only permission is assuming the CDK bootstrap roles", () => {
        template.hasResourceProperties("AWS::IAM::Policy", {
            PolicyDocument: {
                Statement: [
                    {
                        Sid: "assumeCdkBootstrapRoles",
                        Action: "sts:AssumeRole",
                        Effect: "Allow",
                        Resource: {
                            "Fn::Join": ["", [
                                "arn:aws:iam::",
                                { Ref: "AWS::AccountId" },
                                ":role/cdk-*"
                            ]]
                        }
                    }
                ]
            }
        });
    });

    test("deploy role ARN is exported for consumer workflows", () => {
        template.hasOutput('DeployRoleArn', {});
    });

    test("action role can sync static site buckets scoped to profile-*", () => {
        template.hasResourceProperties("AWS::IAM::Policy", {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Sid: "staticSiteSync",
                        Action: ["s3:ListBucket", "s3:PutObject", "s3:DeleteObject"],
                        Effect: "Allow",
                        Resource: ["arn:aws:s3:::profile-*", "arn:aws:s3:::profile-*/*"]
                    })
                ])
            }
        });
    });

    test("action role can invalidate CloudFront distributions in this account only", () => {
        template.hasResourceProperties("AWS::IAM::Policy", {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Sid: "staticSiteInvalidation",
                        Action: "cloudfront:CreateInvalidation",
                        Effect: "Allow",
                        Resource: {
                            "Fn::Join": ["", [
                                "arn:aws:cloudfront::",
                                { Ref: "AWS::AccountId" },
                                ":distribution/*"
                            ]]
                        }
                    })
                ])
            }
        });
    });
});