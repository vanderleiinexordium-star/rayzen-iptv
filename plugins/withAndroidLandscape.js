const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withAndroidLandscape(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];
    const activities = application?.activity ?? [];
    for (const activity of activities) {
      if (activity.$?.["android:name"] === ".MainActivity" ||
          activity.$?.["android:name"]?.endsWith(".MainActivity")) {
        activity.$["android:screenOrientation"] = "landscape";
      }
    }
    return config;
  });
};
