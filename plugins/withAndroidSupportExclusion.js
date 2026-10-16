const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Excludes the legacy com.android.support library from all configurations
 * to prevent duplicate class conflicts with AndroidX.
 */
const withAndroidSupportExclusion = (config) => {
  return withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    const exclusionBlock = `
configurations.all {
    exclude group: 'com.android.support', module: 'support-compat'
    exclude group: 'com.android.support', module: 'versionedparcelable'
}
`;

    if (!buildGradle.includes("exclude group: 'com.android.support'")) {
      // Insert before the android { block
      config.modResults.contents = buildGradle.replace(
        /^android\s*\{/m,
        `${exclusionBlock}\nandroid {`
      );
    }

    return config;
  });
};

module.exports = withAndroidSupportExclusion;
