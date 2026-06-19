import { aws_ec2, aws_ecr, aws_ecs, aws_ecs_patterns } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

type ECSStackProps = cdk.StackProps & {
    repository: aws_ecr.Repository;
}

export class ECSStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ECSStackProps) {
        super(scope, id, props);

        // create vpc and cluter
        const vpc = new aws_ec2.Vpc(this, "ProfileVPC", { maxAzs: 2 });
        const cluster = new aws_ecs.Cluster(this, "ProfileCluster", { vpc });

        // create fargate service with ALB at in the front
        new aws_ecs_patterns.ApplicationLoadBalancedFargateService(this, "ProfileFrontend", {
            cluster,
            minHealthyPercent: 100,
            maxHealthyPercent: 200,
            circuitBreaker: {
                enable: true,
                rollback: true
            },
            taskImageOptions: {
                image: aws_ecs.ContainerImage.fromEcrRepository(props.repository, "3d78bba494d8a045e154598359e4d050968d0aba") // is there a way to make this tag reactive to changes?
            }
        })
    }
}
