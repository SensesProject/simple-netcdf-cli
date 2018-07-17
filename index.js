const netcdf4 = require('netcdf4')
const chalk = require('chalk')
const readline = require('readline')
const fs = require('fs')
const { scaleLinear } = require('d3-scale')
const { interpolateViridis } = require('d3-scale-chromatic')

const args = process.argv.filter((d, i) => i > 2)
const options = {
  inspect: args.indexOf('-i') !== -1,
  path: process.argv[2],
  output: args.indexOf('-o') !== -1,
  outputPath: args[args.indexOf('-o') + 1] || `${process.argv[2]}.csv`
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

  if (options.inspect) inspect(file)
  if (options.output) convert(file)
}

function inspect (file) {
  const rootAttributes = file.root.attributes
  const rootVariables = file.root.variables
  const rootDimensions = file.root.dimensions

  console.log(file.root.variables.time.readSlice(0, 94))
  console.log(Object.keys(file.root.variables.time.readSlice(0, 94)))


  // root
  // if (options.verbose) {
  //   logH1('root')
  //   logProps(file.root)
  // }
  // // attributes
  // logH1('attributes')
  // logAttributes(rootAttributes)
  // // dimensions
  // logH1('dimensions')
  // logDimensions(rootDimensions, true)
  // // variables
  // logH1('variables')
  // Object.keys(rootVariables).forEach(key => {
  //   const {
  //     name, type, attributes, dimensions
  //   } = rootVariables[key]
  //   // variable
  //   if (options.verbose) {
  //     logH2(name)
  //     logProps(rootVariables[key])
  //   } else {
  //     logH2(`${name} (${type})`)
  //   }
  //   // dimensions
  //   logH3('dimensions')
  //   logDimensions(dimensions)
  //   // attributes
  //   logH3('attributes')
  //   logAttributes(attributes)
  // })
}

function convert (file) {
  console.log('convert')
  const variables = file.root.variables
  const output = Object.keys(variables).map(key => {
    const variable = variables[key]

    let values = []
    if (key === 'time') {
      values = variable.readSlice(0, 94).map(((d, i) => 2006 + i))
    } else {
      values = variable.readSlice(0, 94)
    }
    return `${key},${values.join(',')}`
  })

  console.log('...')
  // console.log(output)
  fs.writeFile(options.outputPath, output.join('\n'), err => {
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
