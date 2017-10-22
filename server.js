#!/usr/bin/env node

const readFileSync = require('fs').readFileSync

const fuse  = require('fuse-bindings')
const parse = require('parse-mount-argv')

const ExclFS = require('.')


const argv = process.argv
if(argv.length < 4)
{
  console.error('Usage:', process.argv[1], '<dev>', '<path>',
                '[-o ownerPerm=<ownerPerm>]', '[-o whitelist=<whitelist>]')
  process.exit(1)
}


const args = parse(argv.slice(2))

const mountPoint = args.path

const options   = args.options
const whitelist = options.whitelist

if(whitelist) options.whitelist = readFileSync(whitelist, 'utf8').split('\n')


fuse.mount(mountPoint, ExclFS(args.dev, options), function(error)
{
  if(error) console.error('ExclFS failed to mount:', error)
})

process.on('SIGINT', function()
{
  fuse.unmount(mountPoint, function()
  {
    process.exit()
  })
})
