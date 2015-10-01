#!/usr/bin/env node

var readFileSync = require('fs').readFileSync

var fuse = require('fuse-bindings')

var ExclFS = require('./')

var parse = require('./parseMountArgv')


var argv = process.argv
if(argv.length < 4)
{
  console.error('Usage:', process.argv[1], '<dev>', '<path>',
                '[-o ownerPerm=<ownerPerm>]', '[-o whitelist=<whitelist>]')
  process.exit(1)
}


var args = parse(argv.slice(2))

var mountPoint = args.path

var options   = args.options
var whitelist = options.whitelist

if(whitelist) options.whitelist = readFileSync(whitelist, 'utf8').split('\n')


fuse.mount(mountPoint, ExclFS(args.dev, options), function(error)
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
