import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

interface CertificateStackProps extends cdk.StackProps {
  domainName: string;
  subdomain: string;
  hostedZoneId: string;
}

export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    // Reference the Hosted Zone directly by ID (avoids synth-time API permissions lookup)
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    this.certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: props.subdomain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
  }
}