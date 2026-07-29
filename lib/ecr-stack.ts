import { aws_ecr } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export class ECRStack extends cdk.Stack {
  public readonly lambdaRepository: aws_ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdaRepository = new aws_ecr.Repository(this, "LambdaECR", {
      repositoryName: "profile-backend-lambda",
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true
    });

    this.lambdaRepository = lambdaRepository;

    new cdk.CfnOutput(this, 'LambdaRepositoryUri', {
      value: lambdaRepository.repositoryUri,
      description: 'Docker push target for the Java backend Lambda image',
    });
  }
}
