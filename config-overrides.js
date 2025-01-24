const webpack = require('webpack');

module.exports = function override(config, env) {
    // Ensure resolve exists
    config.resolve = config.resolve || {};
    config.resolve.fallback = config.resolve.fallback || {};

    // Add Node.js polyfills
    Object.assign(config.resolve.fallback, {
        assert: require.resolve('assert/'),
        buffer: require.resolve('buffer/'),
        crypto: require.resolve('crypto-browserify'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        os: require.resolve('os-browserify/browser'),
        path: require.resolve('path-browserify'),
        process: require.resolve('process/browser'),
        stream: require.resolve('stream-browserify'),
        url: require.resolve('url/'),
        util: require.resolve('util/'),
        zlib: require.resolve('browserify-zlib'),
        // Disable Node.js specific modules
        fs: false,
        net: false,
        tls: false,
        child_process: false,
    });

    // Add module resolution configuration
    config.resolve = {
        ...config.resolve,
        alias: {
            ...config.resolve.alias,
            process: 'process/browser',
        },
        extensions: ['.js', '.mjs', '.jsx', '.json', '.wasm'],
        fullySpecified: false
    };

    // Add necessary plugins
    config.plugins = [
        ...(config.plugins || []),
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer'],
        }),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        }),
    ];

    // Ignore specific warnings
    config.ignoreWarnings = [
        /Failed to parse source map/,
        /Critical dependency/,
        /Module not found: Error: Can't resolve 'webworker-threads'/,
        /Module not found: Error: Can't resolve 'pg-native'/,
    ];

    return config;
}; 