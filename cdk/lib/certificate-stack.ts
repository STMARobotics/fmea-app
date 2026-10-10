import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

interface CertificateStackProps extends cdk.StackProps {
  domainName: string;
  subdomain: string;
}

export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    // Route 53 Hosted Zone lookup (global, works from any region)
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.domainName,
    });

    // ACM Certificate MUST be in us-east-1 for CloudFront
    this.certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: props.subdomain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
  }
}