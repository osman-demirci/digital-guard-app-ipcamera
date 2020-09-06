module.exports = {
  entry: __dirname + "/index.js",
  mode: "production",
  output: {
    path: __dirname + '/dist',
    filename: 'main.js',
    libraryTarget: 'umd',
    library: ''
  },
}
