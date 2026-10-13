export interface AppConfig {
  domainName: string;
  subdomain: string;
  hostedZoneId: string;
  backendStackName: string;
  frontendStackName: string;
  certificateStackName: string;
  googleClientId: string;
  allowedDomain: string;
}

export const prodConfig: AppConfig = {
  domainName: '7028robotics.com',
  subdomain: 'fmea.7028robotics.com',
  hostedZoneId: 'Z014656337LGZWAE9JKJP',
  backendStackName: 'fmea-backend',
  frontendStackName: 'fmea-frontend',
  certificateStackName: 'fmea-certificate',
  googleClientId: '574028865613-b8apa4bcpai776gtsqm14mdej3iubeha.apps.googleusercontent.com',
  allowedDomain: 'stmarobotics.org',
};