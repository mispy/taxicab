const path = require('path')
const webpack = require('webpack')
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const ManifestPlugin = require('webpack-manifest-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const BASE_PATH = process.env.BASE_PATH

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production'
    return {
        context: __dirname,
        mode: argv.mode||'development',
        entry: path.join(__dirname, 'src/index.ts'),
        output: {
            path: path.join(__dirname, "build", BASE_PATH||""),
            filename: "assets/[name].js",
            libraryTarget: 'umd'
        },
        resolve: {
            extensions: [".ts", ".tsx", ".js", ".css"],
            modules: [
                path.join(__dirname, "node_modules"),
            ],
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    loader: "ts-loader",
                    options: {
                        transpileOnly: true,
                        configFile: path.join(__dirname, "tsconfig.json")
                    }
                },
                {
                    test: /\.css$/,
                    loader: ExtractTextPlugin.extract({ fallback: 'style-loader', use: ['css-loader?modules&importLoaders=1&localIdentName=[local]'] })
                },
                {
                    test: /\.scss$/,
                    loader: ExtractTextPlugin.extract({ fallback: 'style-loader', use: ['css-loader?modules&importLoaders=1&localIdentName=[local]', 'sass-loader'] })
                },
                {
                    test: /\.(jpe?g|gif|png|eot|woff|ttf|svg|woff2)$/,
                    loader: 'url-loader?limit=10000'
                }
            ],
        },
        plugins: [
            // This plugin extracts css files required in the entry points
            // into a separate CSS bundle for download
            new ExtractTextPlugin('assets/[name].css'),
            new ManifestPlugin(),
            new CopyWebpackPlugin([{ 
                from: 'public',
                transform: (content, path) => {
                    if (BASE_PATH && path.match(/index.html$/)) {
                        const s = content.toString('utf8')
                        return Buffer.from(s.replace(/\.\/assets/g, BASE_PATH+'/assets'))
                    }
                    return content
                }
            }])
        ],
        devServer: {
            host: 'localhost',
            port: 8020,
            contentBase: 'public',
            disableHostCheck: true,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
            }
        },    
    }
}
