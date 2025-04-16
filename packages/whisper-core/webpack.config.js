const path = require('path');

module.exports = (env) => {
    const environment = env.environment || 'local';
    return {
        mode: environment === 'local' ? 'development' : 'production',
        entry: {
            whisper: './src/index.ts',
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist'),
            clean: true,
            publicPath: '/',
            library: {
                name: 'Whisper',
                type: 'umd',
            },
            globalObject: 'this',
        },
        devtool: environment === 'local' ? 'inline-source-map' : 'source-map',
        resolve: {
            extensions: ['.ts', '.js'],
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: 'ts-loader',
                },
            ],
        },
        optimization: {
            minimize: environment !== 'local',
        },
        bail: false,
    };
};
