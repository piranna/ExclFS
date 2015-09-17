#!/usr/bin/env node

var readFileSync = require('fs').readFileSync

var fuse = require('fuse-bindings')

var ExclFS = require('./')


if(process.argv.length < 4)
{
  console.error('Usage:', process.argv[1], '<mountPoint>', '<lowerLayer>',
                '[whitelist]')
  process.exit(1)
}

var mountPoint = process.argv[2]
var lowerLayer = process.argv[3]
var whitelist  = process.argv[4]

if(whitelist) whitelist = readFileSync(whitelist, 'utf8').split('\n')


fuse.mount(mountPoint, ExclFS(lowerLayer, whitelist))

process.on('SIGINT', function()
{
  fuse.unmount(mountPoint, function()
  {
    process.exit()
  })
})
