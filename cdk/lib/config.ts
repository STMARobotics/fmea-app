export interface AppConfig {
  domainName: string;
  subdomain: string;
  hostedZoneId: string;
  backendStackName: string;
  frontendStackName: string;
  certificateStackName: string;
}

export const prodConfig: AppConfig = {
  domainName: '7028robotics.com',
  subdomain: 'fmea.7028robotics.com',
  hostedZoneId: 'Z014656337LGZWAE9JKJP',
  backendStackName: 'fmea-backend',
  frontendStackName: 'fmea-frontend',
  certificateStackName: 'fmea-certificate',
};