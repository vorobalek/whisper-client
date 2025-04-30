const path = require('path');
const { DefinePlugin } = require('webpack');
const HtmlPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const JsonMinimizerPlugin = require('json-minimizer-webpack-plugin');
const { getTemplateParameters, getParameterReplacer, getEnvironmentVariables } = require('@whisper/app/config');

module.exports = (args) => {
    env = {
        ...args,
        ...process.env,
    };
    const isServe = env.WEBPACK_SERVE === true;
    const templateParameters = getTemplateParameters(env);

    return {
        mode: isServe ? 'development' : 'production',
        entry: {
            'app.min': path.resolve(__dirname, 'packages/whisper-app/src/index.tsx'),
            'core.min': {
                import: path.resolve(__dirname, 'packages/whisper-core/src/index.ts'),
                library: {
                    name: 'Whisper',
                    type: 'umd',
                },
            },
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist'),
            clean: true,
            publicPath: '/',
        },
        externals: {
            'react': 'React',
            'react-dom': 'ReactDOM',
            '@zxing/library': 'ZXing',
            '@whisper/core': 'Whisper',
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js', '.css'],
            alias: {
                '@whisper/core': path.resolve(__dirname, './packages/whisper-core/src'),
            },
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    exclude: /node_modules/,
                    oneOf: [
                        {
                            include: path.resolve(__dirname, 'packages/whisper-app'),
                            use: [
                                {
                                    loader: 'ts-loader',
                                    options: {
                                        configFile: path.resolve(__dirname, 'packages/whisper-app/tsconfig.json'),
                                    },
                                },
                            ],
                        },
                        {
                            include: path.resolve(__dirname, 'packages/whisper-core'),
                            use: [
                                {
                                    loader: 'ts-loader',
                                    options: {
                                        configFile: path.resolve(__dirname, 'packages/whisper-core/tsconfig.json'),
                                    },
                                },
                            ],
                        },
                    ],
                },
                {
                    test: /\.css$/,
                    exclude: /node_modules/,
                    use: [MiniCssExtractPlugin.loader, 'css-loader'],
                },
                {
                    test: /\.json$/,
                    type: 'asset/resource',
                },
            ],
        },
        plugins: [
            new DefinePlugin({
                'process.env': getEnvironmentVariables(templateParameters),
            }),
            new HtmlPlugin({
                template: path.resolve(__dirname, './packages/whisper-app/public/index.html'),
                inject: false,
                templateParameters: templateParameters,
            }),
            new CopyPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, './packages/whisper-app/src/service-worker.js'),
                        to: path.resolve(__dirname, './dist/service-worker.js'),
                        transform: {
                            transformer: getParameterReplacer(templateParameters),
                        },
                    },
                    {
                        from: path.resolve(__dirname, './packages/whisper-app/public/manifest.json'),
                        to: path.resolve(__dirname, './dist/manifest.json'),
                        transform: {
                            transformer: getParameterReplacer(templateParameters),
                        },
                    },
                    {
                        from: path.resolve(__dirname, './packages/whisper-app/public/assets/'),
                        to: path.resolve(__dirname, './dist/assets/'),
                    },
                    {
                        from: path.resolve(__dirname, './packages/whisper-app/public/docs/'),
                        to: path.resolve(__dirname, './dist/docs/'),
                    },
                    {
                        from: path.resolve(__dirname, './packages/whisper-app/public/scripts/'),
                        to: path.resolve(__dirname, './dist/scripts/'),
                    },
                ],
            }),
            new MiniCssExtractPlugin({
                filename: '[name].css',
            }),
        ],
        optimization: {
            minimize: !isServe,
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        format: {
                            comments: false,
                        },
                    },
                    extractComments: false,
                }),
                new CssMinimizerPlugin(),
                new JsonMinimizerPlugin(),
            ],
            splitChunks: {
                cacheGroups: {
                    default: false,
                    vendors: false,
                },
            },
        },
        bail: false,
        devtool: isServe ? 'inline-source-map' : 'source-map',
        devServer: {
            static: [
                {
                    directory: path.join(__dirname, 'dist'),
                },
                {
                    directory: path.join(__dirname, 'packages/whisper-core/coverage'),
                    publicPath: '/coverage',
                },
            ],
            port: 8080,
            historyApiFallback: true,
            client: {
                overlay: false,
            },
        },
    };
};
