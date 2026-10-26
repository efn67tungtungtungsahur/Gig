import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.gig.app',
  appName: 'Athlos',
  webDir: 'dist',
  android: {
    backgroundColor: '#0e1116',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_gig',
      iconColor: '#7c9cff',
    },
  },
};

export default config;
