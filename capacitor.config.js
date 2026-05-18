/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "com.hikahquest.app",
  appName: "HikahQuest",
  webDir: "native-web",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https"
  }
};

module.exports = config;
