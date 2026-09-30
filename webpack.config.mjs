import path from 'node:path';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

export default function config(env, argv) {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/ui/index.tsx',
    output: {
      path: path.resolve('.', 'public'),
      filename: 'js/app.js',
      clean: false
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    resolve: {
      extensions: ['.tsx', '.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: 'defaults' }],
                ['@babel/preset-react', { runtime: 'automatic', development: !isProduction }],
                '@babel/preset-typescript'
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader']
        }
      ]
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: 'css/toureiro.css'
      })
    ],
    performance: {
      hints: false
    }
  };
}