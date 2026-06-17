import { aws_ecr } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export class ECRStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new aws_ecr.Repository(this, "TaneECR", {
      repositoryName: "profile-repo",
      imageScanOnPush: true, // automatically scan for vulnerabilities
      imageTagMutability: aws_ecr.TagMutability.IMMUTABLE, // immutable to force versioning
      removalPolicy: cdk.RemovalPolicy.DESTROY, // will destroy repo and all images (not good for prod use but I want this)
      emptyOnDelete: true // required to destrory a NON-EMPTY repo
    });
  }
}
