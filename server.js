#!/usr/bin/env node

var readFileSync = require('fs').readFileSync

var fuse = require('fuse-bindings')

var ExclFS = require('./')


// http://stackoverflow.com/a/1555146/586382
function setOption(arg)
{
  arg = arg.split('=')

  var key, value

  if(arg.length > 1)
  {
    key   = arg.shift()
    value = arg.join('=')
  }
  else
  {
    key = arg
    value = true
  }

  this[key] = value
}

function processOptions(arg)
{
  if(arg === '-o') continue

  arg.split(',').forEach(setOption, this)
}

function parse(argv)
{
  var options = {}

  var result =
  {
    dev:     argv[0],
    path:    argv[1],
    options: options
  }

  argv.slice(2).forEach(processOptions, options)

  return result
}


var argv = process.argv
if(argv.length < 4)
{
  console.error('Usage:', process.argv[1], '<dev>', '<path>',
                '[-o whitelist=<whitelist>]')
  process.exit(1)
}

var args = parse(argv.slice(2))

var mountPoint = args.path
var whitelist  = args.options.whitelist

if(whitelist) whitelist = readFileSync(whitelist, 'utf8').split('\n')


fuse.mount(mountPoint, ExclFS(args.dev, whitelist), function(error)
{
  if(error) console.error('ExclFS failed to mount:',error)
})

process.on('SIGINT', function()
{
  fuse.unmount(mountPoint, function()
  {
    process.exit()
  })
})
