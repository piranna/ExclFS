#!/usr/bin/env node

var readFileSync = require('fs').readFileSync

var fuse = require('fuse-bindings')

var ExclFS = require('./')

var parse = require('./parseMountArgv')


function usage()
{
  console.error('Usage:', process.argv[1], 'null', '<path>',
                '-o lowerLayer=<lowerLayer>', '[-o whitelist=<whitelist>]')
  process.exit(1)
}


var argv = process.argv
if(argv.length < 4) usage()

var args = parse(argv.slice(2))

var mountPoint = args.path
var lowerLayer = args.options.lowerLayer
var whitelist  = args.options.whitelist

if(!lowerLayer) usage()
if(whitelist) whitelist = readFileSync(whitelist, 'utf8').split('\n')


fuse.mount(mountPoint, ExclFS(lowerLayer, whitelist), function(error)
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
