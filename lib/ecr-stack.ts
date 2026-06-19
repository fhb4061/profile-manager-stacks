import { aws_ecr } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export class ECRStack extends cdk.Stack {
  public readonly repository: aws_ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = new aws_ecr.Repository(this, "ECR", {
      repositoryName: "profile-manager-fe",
      imageScanOnPush: true, // automatically scan for vulnerabilities
      // imageTagMutability: aws_ecr.TagMutability.IMMUTABLE, // immutable to force versioning
      removalPolicy: cdk.RemovalPolicy.DESTROY, // will destroy repo and all images (not good for prod use but I want this)
      emptyOnDelete: true // required to destrory a NON-EMPTY repo
    });

    this.repository = repository;
  }
}
