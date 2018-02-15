const netcdf4 = require('netcdf4')
const chalk = require('chalk')
const readline = require('readline')
const fs = require('fs')
const { scaleLinear } = require('d3-scale')
const { interpolateViridis } = require('d3-scale-chromatic')

const args = process.argv.filter((d, i) => i > 2)
const options = {
  inspect: args.indexOf('-i') !== -1 || args.indexOf('-i') !== -1,
  verbose: args.indexOf('-v') !== -1,
  path: process.argv[2],
  preview: args.indexOf('-p') !== -1,
  previewTime: args[args.indexOf('-p') + 1] || 0,
  animation: args.indexOf('-a') !== -1,
  output: args.indexOf('-o') !== -1,
  outputPath: args[args.indexOf('-o') + 1] || 'out.json'
}

init()

function init () {
  let file = null
  try {
    file = new netcdf4.File(options.path, 'r')
  } catch (e) {
    console.log(chalk.red('Error reading file'))
    return
  }

  if (options.inspect || options.verbose) inspect(file)
  if (options.preview) preview(file, options.previewTime)
  if (options.animation) animate(file)
  if (options.output) convert(file)
}

function inspect (file) {
  const rootAttributes = file.root.attributes
  const rootVariables = file.root.variables
  const rootDimensions = file.root.dimensions

  // root
  if (options.verbose) {
    logH1('root')
    logProps(file.root)
  }
  // attributes
  logH1('attributes')
  logAttributes(rootAttributes)
  // dimensions
  logH1('dimensions')
  logDimensions(rootDimensions, true)
  // variables
  logH1('variables')
  Object.keys(rootVariables).forEach(key => {
    const {
      name, type, attributes, dimensions
    } = rootVariables[key]
    // variable
    if (options.verbose) {
      logH2(name)
      logProps(rootVariables[key])
    } else {
      logH2(`${name} (${type})`)
    }
    // dimensions
    logH3('dimensions')
    logDimensions(dimensions)
    // attributes
    logH3('attributes')
    logAttributes(attributes)
  })
}

function preview (file, time) {
  const dimensions = file.root.dimensions
  const variables = file.root.variables
  const stride = Math.ceil(Math.max(
    dimensions.lon.length / process.stdout.columns, dimensions.lat.length / (process.stdout.rows - 2)
  ))
  const width = Math.floor(dimensions.lon.length / stride)
  const height = Math.floor(dimensions.lat.length / stride)

  const key = Object.keys(variables).find(variable =>
    Object.keys(dimensions).indexOf(variable) === -1
  )

  const missing = variables[key].attributes.missing_value.value

  const data = variables[key].readStridedSlice(
    time, 1, 1, // time
    0, height, stride, // lat
    0, width, stride // lon
  )
  const validData = data.filter(d => d !== missing && d > 0)
  const max = Math.max(...validData)
  const min = Math.min(...validData)

  var scale = scaleLinear()
    .domain([min, max])
    .range([0, 1])

  console.log(chalk.bold(`${variables[key].attributes.long_name.value} (${variables[key].attributes.units.value})`))
  console.log(chalk.bold(`time: ${time}`))
  process.stdout.write(`${min} `)
  const legend = ' '.repeat(16 + 1).split('').map((d, i) => i / 16)
  legend.forEach(d => {
    process.stdout.write(chalk.bgHex(interpolateViridis(d))(` `))
  })
  process.stdout.write(` ${max}`)
  process.stdout.write('\n')

  data.forEach((d, i) => {
    if (i % width === 0) process.stdout.write('\n')
    if (d === missing) process.stdout.write(' ')
    else process.stdout.write(chalk.bgHex(interpolateViridis(scale(d)))(' '))
  })
  process.stdout.write('\n')

  // console.log(chalk.white.bgCyan(` time (${variables.time.attributes.units.value}): ${time} `))
  // console.log(chalk.white.bgMagenta(` resolution: 1/${stride} `))
}

function animate (file) {
  const dimensions = file.root.dimensions
  const stride = Math.ceil(Math.max(
    dimensions.lon.length / process.stdout.columns, dimensions.lat.length / (process.stdout.rows - 2)
  ))
  const width = Math.floor(dimensions.lon.length / stride)
  const height = Math.floor(dimensions.lat.length / stride)

  for (var i = 0; i < dimensions.time.length; i++) {
    preview(file, i)
    readline.moveCursor(process.stdout, -width, -height - 4)
  }
}

function convert (file) {
  console.log('convert')
  const variables = file.root.variables
  const output = Object.keys(variables).map(key => {
    const variable = variables[key]
    const {dimensions, name, attributes} = variable

    dimensions[0].length = 1
    const accessor = (dimensions.map((dimension, i) => [0, i === 0 ? 1 : dimension.length]).reduce((a, b) => a.concat(b), []))
    console.log(accessor)
    const data = variable.readSlice(...accessor)
    // const data = extract(variable, 0, dimensions.map(d => 0))
    console.log(data.length)
    return {
      variable: name,
      attributes,
      dimensions,
      data
    }
  })

  console.log('...')
  // console.log(output)
  fs.writeFile(options.outputPath, JSON.stringify(output), err => {
    if (err) throw err
    console.log(chalk.bold.white.bgGreen(`Saved to ${options.outputPath}`))
  })
}

function extract (variable, dimensionIndex, accessor) {
  return ' '.repeat(variable.dimensions[dimensionIndex].length).split('').map((d, i) => {
    if (dimensionIndex + 1 < variable.dimensions.length) {
      accessor[dimensionIndex] = i
      // console.log(accessor)
      return extract(variable, dimensionIndex + 1, accessor)
    } else {
      return variable.read(...accessor)
    }
  })
}

// console.log(file.root.variables['tas'].readSlice(0, 1, 0, 1, 0, 10))

// fill()

// Helper Functions
function logProp (property, value) {
  console.log(chalk.magenta(`${property}:${' '.repeat(Math.max(1, 15 - property.length))}`), value)
}

function logProps (obj, keys) {
  if (keys == null) keys = Object.keys(obj)
  keys.forEach(key => logProp(key, obj[key]))
}

function logAttributes (obj) {
  Object.keys(obj).forEach(key => {
    logProp(obj[key].name, obj[key].value)
  })
}

function logDimensions (obj, root) {
  Object.keys(obj).forEach(key => {
    if (options.verbose) {
      if (root) logH2(obj[key].name)
      else logH4(obj[key].name)

      logProp('length', obj[key].length)
    } else {
      logProp(obj[key].name, `length: ${obj[key].length}`)
    }
  })
}

function logH1 (title) {
  console.log(chalk.white.bgBlue.bold(`\n${title.toUpperCase()}${' '.repeat(Math.max(1, 32 - title.length))}`))
}

function logH2 (title) {
  console.log(chalk.white.bgCyan.bold(`\n${title}${' '.repeat(Math.max(1, 28 - title.length))}`))
}

function logH3 (title) {
  console.log(chalk.white.bgGreen.bold(`\n${title}${' '.repeat(Math.max(1, 24 - title.length))}`))
}

function logH4 (title) {
  console.log(chalk.white.bgYellow.bold(`\n${title}${' '.repeat(Math.max(1, 20 - title.length))}`))
}

// function fill () {
//   for (var i = 0; i < 360 / 2; i++) {
//     console.log(chalk.bgYellow.bold(' '.repeat(720)))
//     console.log(chalk.bgBlue.bold(' '.repeat(720)))
//   }
// }
