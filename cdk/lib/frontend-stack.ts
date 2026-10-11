import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import * as path from 'path';

interface FrontendStackProps extends cdk.StackProps {
  domainName: string;
  subdomain: string;
  hostedZoneId: string;
  apiFunctionUrl: lambda.IFunctionUrl;
  certificate: acm.ICertificate;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // 1. Retreive the existing Hosted Zone from Route 53
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    // 2. Private S3 Bucket for Static Frontend Assets
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      code: cloudfront.FunctionCode.fromInline(
        "function handler(event) { var request = event.request; if (request.uri !== '/' && request.uri.indexOf('.') === -1) { request.uri = '/index.html'; } return request; }",
      ),
    });

    // 3. CloudFront Distribution with S3 and Lambda Function URL origins
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      domainNames: [props.subdomain],
      certificate: props.certificate,
      defaultRootObject: 'index.html',

      // Serve static UI assets from S3
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        functionAssociations: [
          {
            function: spaRewrite,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },

    });

    distribution.addBehavior(
      '/api/*',
      origins.FunctionUrlOrigin.withOriginAccessControl(props.apiFunctionUrl),
      {
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    );

    // 5. Automatically deploy built UI assets to S3 and invalidate CloudFront
    // Note: Ensure /ui/dist exists or update path to match your UI build directory
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../ui/dist/fmea-poc-ui/browser'))],
      destinationBucket: siteBucket,
      distribution: distribution,
      distributionPaths: ['/*'],
    });

    // 6. Route 53 Alias Record pointing subdomain to CloudFront
    new route53.ARecord(this, 'SiteAliasRecord', {
      zone: hostedZone,
      recordName: props.subdomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
    });
  }
}