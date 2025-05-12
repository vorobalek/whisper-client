const path = require('path');
const { DefinePlugin } = require('webpack');
const HtmlPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { getTemplateParameters, getParameterReplacer, getEnvironmentVariables } = require('./config');

module.exports = (args) => {
    const env = {
        ...args,
        ...process.env,
    };
    const environment = env.environment || 'local';
    const templateParameters = getTemplateParameters(env);
    const environmentVariables = getEnvironmentVariables(templateParameters);

    // noinspection WebpackConfigHighlighting
    return {
        mode: environment === 'local' ? 'development' : 'production',
        entry: {
            modern: './src/index.tsx',
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist'),
            clean: true,
            publicPath: '/',
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js', '.css'],
            alias: {
                '@whisper/core': path.resolve(__dirname, './../whisper-core/src'),
            },
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    exclude: /node_modules/,
                    include: [path.resolve(__dirname, 'src'), path.resolve(__dirname, '../whisper-core/src')],
                    loader: 'ts-loader',
                    options: {
                        configFile: path.resolve(__dirname, 'tsconfig.json'),
                    },
                },
                {
                    test: /\.css$/,
                    exclude: /node_modules/,
                    use: [MiniCssExtractPlugin.loader, 'css-loader'],
                },
            ],
        },
        plugins: [
            new DefinePlugin({
                'process.env': environmentVariables,
            }),
            new HtmlPlugin({
                template: path.resolve(__dirname, './public/index.html'),
                inject: false,
                templateParameters: templateParameters,
            }),
            new CopyPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, './src/service-worker.js'),
                        to: path.resolve(__dirname, './dist/service-worker.js'),
                        transform: {
                            transformer: getParameterReplacer(templateParameters),
                        },
                    },
                    {
                        from: path.resolve(__dirname, './public/manifest.json'),
                        to: path.resolve(__dirname, './dist/manifest.json'),
                        transform: {
                            transformer: getParameterReplacer(templateParameters),
                        },
                    },
                    {
                        from: path.resolve(__dirname, './public/assets/'),
                        to: path.resolve(__dirname, './dist/'),
                    },
                ],
            }),
            new MiniCssExtractPlugin({
                filename: '[name].css',
            }),
        ],
    };
};
