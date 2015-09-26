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

  argv = argv.slice(2)

  while(argv.length)
  {
    var token = argv.shift()
    switch(token)
    {
      case '-o': case '--options':
        processOptions.call(options, argv.shift())
      break

      default: throw 'Unknown argument '+token
    }
  }

  return result
}


module.exports = parse
