export interface AppConfig {
  domainName: string;
  subdomain: string;
  hostedZoneId: string;
  backendStackName: string;
  frontendStackName: string;
  certificateStackName: string;
  googleClientId: string;
  googleClientSecretParameter: string;
  allowedDomain: string;
}

export const prodConfig: AppConfig = {
  domainName: '7028robotics.com',
  subdomain: 'fmea.7028robotics.com',
  hostedZoneId: 'Z014656337LGZWAE9JKJP',
  backendStackName: 'fmea-backend',
  frontendStackName: 'fmea-frontend',
  certificateStackName: 'fmea-certificate',
  googleClientId: '574028865613-kh9gccmi9ccfqsv7s89rdttf7cc1ohj4.apps.googleusercontent.com',
  googleClientSecretParameter: '/fmea/google-client-secret',
  allowedDomain: 'stmarobotics.org',
};