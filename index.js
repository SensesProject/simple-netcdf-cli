const netcdf4 = require('netcdf4')
const chalk = require('chalk')
const readline = require('readline')
const fs = require('fs')
const { scaleLinear, scaleSequential } = require('d3-scale')
const { interpolateViridis } = require('d3-scale-chromatic')

const path = process.argv[2]
const args = process.argv.filter((d, i) => i > 2)

const options = {
  timestep: args.indexOf('-t') >= 0 ? +args[args.indexOf('-t') + 1] || 0 : 0,
  output: args.indexOf('-o') >= 0 ? +args[args.indexOf('-o') + 1] || `${path}.json` : `${path}.json`
}

console.log(options)

let file = null
try {
  file = new netcdf4.File(path, 'r')
} catch (e) {
  console.log(chalk.red('Error reading file'))
  return
}

const variables = file.root.variables

const meta = inspectFile(file)
const timesteps = meta.dimensions.find(d => d.name === 'time').length
const timestep = (timesteps + options.timestep) % timesteps

const data = getData(file, [[0, 0], [720 - 1, 360 - 1]], [timestep, timestep], meta)
const flat = data.reduce((a, b) => a.concat(b), []).filter(d => d !== null).reduce((a, b) => a.concat(b), []).filter(d => d !== null)

const domain = [Math.min(...flat), Math.max(...flat)]

const scale = scaleLinear()
  .domain(domain)
  // .range(domain)
  .nice()

const ticks = scale.ticks(8)

scale.range([0, ticks.length])

const niceDomain = scale.domain()

const grid = data.map(y => {
  return y.map(lat => {
    return lat.map(v => {
      if (v === null) return String.fromCharCode(32)
      let charCode = 33 + Math.floor(scale(v))
      if (charCode >= 34) charCode++
      if (charCode >= 92) charCode++

      return String.fromCharCode(charCode)
    }).join('')
  })
})

const out = {
  grid,
  range: scale.domain(),
  domain: scale.range()
}

fs.writeFile(options.output, JSON.stringify(out, null, 2), err => {
  if (err) throw errs
})

function getData (file, bbox, time, meta) {
  const variable = meta.variables.find(v =>
    meta.dimensions.find(d => d.name === v.name) === undefined
  )

  const na = [variable.attributes._FillValue, variable.attributes.missing_value]
  console.log(na)

  const timeSize = time[1] - time[0]
  const lonSize = bbox[1][0] - bbox[0][0]
  const latSize = bbox[1][1] - bbox[0][1]

  console.log(timeSize, lonSize, latSize)

  const data = []

  for (let timeIndex = time[0]; timeIndex <= time[1]; timeIndex ++) {
    const lonData = []
    for (let latIndex = bbox[0][1]; latIndex <= bbox[1][1]; latIndex ++) {
      const slices = [
        [timeIndex, 1],
        [latIndex, 1],
        [bbox[0][1], lonSize + 1]
      ]
      const values = file.root.variables[variable.name].readSlice(...slices.reduce((a, b) => a.concat(b), []))
      lonData.push(Array.prototype.slice.call(values).map(d => (d === na[0] || d === na[1]) ? null : d))
    }
    data.push(lonData)
  }
  return data
}

function inspectFile (file) {
  const rootAttributes = file.root.attributes
  const rootVariables = file.root.variables
  const rootDimensions = file.root.dimensions

  return {
    attributes: extractAttributes(rootAttributes),
    dimensions: extractDimensions(rootDimensions),
    variables: Object.keys(rootVariables).map(key => {
      const { name, attributes } = rootVariables[key]
      return {
        name,
        attributes: extractAttributes(attributes)
      }
    })
  }
}

function extractAttributes (attributes) {
  const keys = Object.keys(attributes)
  const obj = {}
  keys.forEach(key => {
    obj[key] = attributes[key].value
  })
  return obj
}

function extractDimensions (dimensions) {
  const keys = Object.keys(dimensions)
  const obj = {}
  return keys.map(key => dimensions[key])
}
