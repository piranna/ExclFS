#!/usr/bin/env node

var fuse = require('fuse-bindings')

var ExclFS = require('./')


if(process.argv.length < 4)
{
  console.error('Usage:', process.argv[1], '<mountPoint>', '<lowerLayer>')
  process.exit(1)
}

var mountPoint = process.argv[2]
var lowerLayer = process.argv[3]


fuse.mount(mountPoint, ExclFS(lowerLayer))

process.on('SIGINT', function()
{
  fuse.unmount(mountPoint, function()
  {
    process.exit()
  })
})
